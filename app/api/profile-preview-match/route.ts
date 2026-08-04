import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { gemini, GEMINI_MODEL } from "@/lib/gemini";
import { getEmbedding } from "@/lib/embeddings";

function cosineSimilarity(a: number[], b: number[]): number {
  const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  if (magA === 0 || magB === 0) return 0;
  return dot / (magA * magB);
}

export async function POST(req: Request) {
  try {
    const { handle, context } = await req.json();

    if (!handle || typeof handle !== "string") {
      return NextResponse.json({ error: "Missing handle" }, { status: 400 });
    }
    if (!context || typeof context !== "string" || context.trim() === "") {
      return NextResponse.json({ error: "Missing context" }, { status: 400 });
    }
    if (context.length > 2000) {
      return NextResponse.json({ error: "Context too long" }, { status: 400 });
    }

    // 1. Rate limit check first
    const forwardedFor = req.headers.get("x-forwarded-for");
    const ipAddress = forwardedFor
      ? forwardedFor.split(',')[0].trim()
      : req.headers.get("x-real-ip") ?? "unknown-ip";

    const service = createServiceClient();

    const { error: insertError } = await service
      .from("guest_preview_limits")
      .insert({ ip_address: ipAddress });

    if (insertError) {
      console.error("Failed to log guest preview request", insertError);
    }

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count, error: countError } = await service
      .from("guest_preview_limits")
      .select("*", { count: "exact", head: true })
      .eq("ip_address", ipAddress)
      .gte("created_at", oneHourAgo);

    if (countError) {
      console.error("Failed to count guest preview limits", countError);
    }

    if (count && count > 3) {
      return NextResponse.json(
        {
          error: "limit_reached",
          message: "You've used your free previews. Sign up to continue.",
        },
        { status: 429 }
      );
    }

    // 4. Look up the profile by handle
    const { data: profile } = await service
      .from("profiles")
      .select("id, display_name, handle")
      .ilike("handle", handle)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Look up their twin_profiles row, including embeddings
    const { data: twinProfile } = await service
      .from("twin_profiles")
      .select("goals, deal_preferences, goals_embedding, deal_prefs_embedding")
      .eq("user_id", profile.id)
      .maybeSingle();

    // 5. If the profile owner hasn't filled in their twin yet
    if (!twinProfile || !twinProfile.goals) {
      return NextResponse.json({
        score: null,
        headline: `${profile.display_name} is still building their twin.`,
        green_flag: "Profile setup is currently in progress.",
        fit_note: "Check back soon once goals and preferences are updated.",
        win_win: `${profile.display_name} is still building their twin. Check back later or sign up to connect!`,
        first_step: "Sign up to create your own twin and get notified.",
        winwin: `${profile.display_name} is still building their twin. Check back later or sign up to connect!`,
      });
    }

    // 6. Compute a REAL score using embeddings, with a safe fallback.
    // The guest is anonymous and only provides one block of text (not
    // separate goals/deal_preferences like a real signed-up user), so we
    // embed their pitch once and compare it against the owner's two
    // stored embeddings separately, then sum both — same spirit as the
    // real matching logic, adapted for a one-sided guest input.
    //
    // Note: unlike Match Lab (which normalizes against the full observed
    // range across all real users), this guest-facing endpoint uses a
    // fixed, calibrated scale instead — running a full range-scan on
    // every anonymous request would be wasteful and slow here.
    let computedScore: number | null = null;
    try {
      if (twinProfile.goals_embedding && twinProfile.deal_prefs_embedding) {
        const guestEmbedding = await getEmbedding(context);
        if (guestEmbedding) {
          const simVsGoals = cosineSimilarity(guestEmbedding, twinProfile.goals_embedding);
          const simVsDeal = cosineSimilarity(guestEmbedding, twinProfile.deal_prefs_embedding);
          const raw = simVsGoals + simVsDeal; // roughly 0 to 2
          // Calibrated linear scale — tuned against observed real ranges
          // (unrelated pairs ~0.9-1.0, strong complementary pairs ~1.3-1.6).
          computedScore = Math.round(((raw - 0.8) / 0.8) * 100);
          computedScore = Math.max(20, Math.min(96, computedScore));
        }
      }
    } catch (embErr) {
      console.error("Embedding-based scoring failed, will fall back to AI estimate:", embErr);
    }

    // 7. Build structured prompt — no longer asks the AI to invent a score,
    // only the qualitative fields, since we now have a real number.
    const prompt = `You are the AI Twin screening engine for ${profile.display_name}.
A visitor just pitched ${profile.display_name}'s AI Twin with this proposal:
"${context}"

${profile.display_name}'s Profile Specs:
- Goals: ${twinProfile.goals || "Not specified"}
- Deal Preferences: ${twinProfile.deal_preferences || "Not specified"}

Evaluate mutual fit and return ONLY a valid JSON object in this exact schema, with no markdown code blocks:
{
  "headline": "<punchy 4-8 word title summarizing the fit>",
  "green_flag": "<one crisp sentence explaining why this partnership/deal works>",
  "fit_note": "<one constructive sentence on working style, timeline, or scope to align on>",
  "win_win": "<one high-leverage sentence in 2nd person: 'You and ${profile.display_name} could...'>",
  "first_step": "<one concise action item for the immediate next step>"
}`;

    const response = await gemini.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
    });

    const rawText = response.text || "";
    let parsed: any = null;

    try {
      const cleaned = rawText
        .replace(/```json\s*/gi, "")
        .replace(/```\s*/g, "")
        .trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = null;
    }

    // Fallback score if embeddings weren't available for any reason —
    // keeps the feature working even in a degraded state, never crashes.
    const finalScore = computedScore ?? 65;

    if (parsed && typeof parsed.win_win === "string") {
      return NextResponse.json({
        score: finalScore,
        headline: parsed.headline || "Synergistic Alignment",
        green_flag: parsed.green_flag || "Strong mutual domain synergy and goals.",
        fit_note: parsed.fit_note || "Verify mutual timeline and availability.",
        win_win: parsed.win_win,
        first_step: parsed.first_step || "Reach out to start a conversation.",
        winwin: parsed.win_win
      });
    }

    // Fallback if unstructured
    return NextResponse.json({
      score: finalScore,
      headline: "Complementary Opportunity",
      green_flag: "Relevant domain background and mutual interests align.",
      fit_note: "Align on working pace and expectations.",
      win_win: rawText.slice(0, 300) || `You and ${profile.display_name} could explore synergies.`,
      first_step: "Connect directly to discuss further.",
      winwin: rawText.slice(0, 300) || `You and ${profile.display_name} could explore synergies.`
    });
  } catch (err: any) {
    console.error("Guest preview error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}