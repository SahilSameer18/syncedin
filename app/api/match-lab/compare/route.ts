import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { gemini, GEMINI_MODEL } from "@/lib/gemini";

export async function POST(req: Request) {
  try {
    // Require authenticated session
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "You must be logged in to use Match Lab" }, { status: 401 });
    }

    const { userIdA, userIdB } = await req.json();
    if (!userIdA || !userIdB) {
      return NextResponse.json({ error: "Both userIdA and userIdB are required" }, { status: 400 });
    }

    const service = createServiceClient();

    const [{ data: profiles, error: profErr }, { data: twinProfiles, error: twinErr }] = await Promise.all([
      service
        .from("profiles")
        .select("id, display_name, avatar_url, email, is_test_persona")
        .in("id", [userIdA, userIdB]),
      service
        .from("twin_profiles")
        .select("user_id, goals, deal_preferences, goals_embedding, deal_prefs_embedding")
        .in("user_id", [userIdA, userIdB])
    ]);

    if (profErr || twinErr) {
      console.error("[match-lab/compare] query failed:", profErr || twinErr);
      return NextResponse.json({ error: "Failed to load profiles" }, { status: 500 });
    }

    const profA = profiles?.find((p: any) => p.id === userIdA);
    const profB = profiles?.find((p: any) => p.id === userIdB);
    const twinA = twinProfiles?.find((t: any) => t.user_id === userIdA);
    const twinB = twinProfiles?.find((t: any) => t.user_id === userIdB);

    if (!profA || !profB || !twinA || !twinB) {
      return NextResponse.json({ error: "One or both user profiles could not be found" }, { status: 404 });
    }

    // Keyword overlap calculation for legacy baseline comparison
    const tokenize = (s: string) => {
      const stops = new Set([
        "the","and","for","with","that","this","what","want","need","into",
        "have","more","just","like","from","your","you","they","them","our",
        "are","not","but","can","will","build","make","get","got","one","two",
        "people","person","time","work","look","looking","find","really",
        "very","much","also","than","then","too","its","there","when","how",
        "who","why","where","which","about","all","any","some"
      ]);
      return new Set(
        (s || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/)
          .filter((w) => w.length >= 4 && !stops.has(w))
      );
    };

    const tokensA_goals = tokenize(twinA.goals || "");
    const tokensA_deals = tokenize(twinA.deal_preferences || "");
    const tokensB_goals = tokenize(twinB.goals || "");
    const tokensB_deals = tokenize(twinB.deal_preferences || "");

    const overlapAtoB = Array.from(tokensA_goals).filter((w) => tokensB_deals.has(w));
    const overlapBtoA = Array.from(tokensB_goals).filter((w) => tokensA_deals.has(w));
    const totalShared = overlapAtoB.length + overlapBtoA.length;
    const sharedWords = Array.from(new Set([...overlapAtoB, ...overlapBtoA]));
    const oldScore = Math.min(100, Math.max(5, totalShared * 10));

    // --- REAL 768-DIM VECTOR EMBEDDING SCORING ---
    // Calibrated Vector Scale for 768-dim Gemini embeddings:
    // Observed raw sum ranges from ~0.90 (unrelated) to ~1.50+ (high synergy).
    // Floor = 0.90, Spread = 0.60 maps raw vector scores into a natural 10% to 98% range.
    let newScore = 0;
    let cosineSim = 0;

    if (twinA.goals_embedding && twinA.deal_prefs_embedding && twinB.goals_embedding && twinB.deal_prefs_embedding) {
      const { data: scoreData, error: rpcErr } = await service.rpc("match_score", {
        my_goals: twinA.goals_embedding,
        my_deal_prefs: twinA.deal_prefs_embedding,
        their_goals: twinB.goals_embedding,
        their_deal_prefs: twinB.deal_prefs_embedding
      });

      if (!rpcErr && typeof scoreData === "number") {
        cosineSim = scoreData;
        newScore = Math.round(((scoreData - 0.90) / 0.60) * 100);
        newScore = Math.max(10, Math.min(98, newScore));
      } else {
        console.warn("[match-lab/compare] rpc error, falling back to keyword score:", rpcErr);
        newScore = oldScore;
      }
    } else {
      newScore = oldScore;
    }

    // AI Qualitative Analysis — strictly aligned with calculated vector score
    let explanation = "Both members share relevant, complementary goals.";
    let matchReasons: string[] = [];
    let mismatchRisks: string[] = [];
    let matchVerdict = newScore >= 70 ? "Strong Fit" : newScore >= 45 ? "Partial Fit" : "Divergent";

    try {
      const nameA = profA.display_name || profA.email?.split("@")[0] || "Person A";
      const nameB = profB.display_name || profB.email?.split("@")[0] || "Person B";

      const prompt = `Analyze the professional matchmaking synergy between two individuals.
Their calculated AI vector compatibility score is ${newScore}%.

Person 1 (${nameA}):
Goals: ${twinA.goals || "None"}
Deal Preferences: ${twinA.deal_preferences || "None"}

Person 2 (${nameB}):
Goals: ${twinB.goals || "None"}
Deal Preferences: ${twinB.deal_preferences || "None"}

Return a raw JSON object (and nothing else) with this exact schema:
{
  "summary": "2 crisp sentences explaining the overall synergy or lack thereof.",
  "matchReasons": ["Specific reason 1 where their goals/skills align", "Specific reason 2 where they complement each other"],
  "mismatchRisks": ["Specific reason 1 where their focus diverges or where friction could arise"],
  "matchVerdict": "Strong Fit" or "Partial Fit" or "Divergent"
}

Your "matchVerdict" MUST be 100% consistent with the ${newScore}% compatibility score above:
- 70% or higher → "Strong Fit"
- 45% to 69% → "Partial Fit"
- below 45% → "Divergent"`;

      const resp = await gemini.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt
      });

      if (resp?.text) {
        const raw = resp.text.trim();
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.summary) explanation = parsed.summary;
          if (Array.isArray(parsed.matchReasons)) matchReasons = parsed.matchReasons;
          if (Array.isArray(parsed.mismatchRisks)) mismatchRisks = parsed.mismatchRisks;
          if (parsed.matchVerdict) matchVerdict = parsed.matchVerdict;
        } else {
          explanation = raw;
        }
      }
    } catch (llmErr) {
      console.warn("[match-lab/compare] explanation generation failed:", llmErr);
    }

    if (matchReasons.length === 0) {
      matchReasons = [
        "Complementary skill sets and mutual stage alignment",
        "Clear synergy between their stated focus areas"
      ];
    }
    if (mismatchRisks.length === 0) {
      mismatchRisks = [
        "May require clear alignment on timeline and day-to-day commitment"
      ];
    }

    return NextResponse.json({
      personA: {
        id: profA.id,
        name: profA.display_name || profA.email?.split("@")[0] || "User A",
        goals: twinA.goals,
        deal_preferences: twinA.deal_preferences
      },
      personB: {
        id: profB.id,
        name: profB.display_name || profB.email?.split("@")[0] || "User B",
        goals: twinB.goals,
        deal_preferences: twinB.deal_preferences
      },
      oldScore: {
        score: oldScore,
        sharedKeywordsCount: totalShared,
        sharedKeywords: sharedWords
      },
      newScore: {
        score: newScore,
        rawCosineSim: Number(cosineSim.toFixed(4))
      },
      matchAnalysis: {
        verdict: matchVerdict,
        matchReasons,
        mismatchRisks
      },
      explanation
    });
  } catch (err: any) {
    console.error("[match-lab/compare] unexpected error:", err);
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
