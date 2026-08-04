import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { gemini, GEMINI_MODEL } from "@/lib/gemini";

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
    // In Next.js App Router, headers can be read from req.headers
    const forwardedFor = req.headers.get("x-forwarded-for");
    const ipAddress = forwardedFor
      ? forwardedFor.split(',')[0].trim()
      : req.headers.get("x-real-ip") ?? "unknown-ip";

    const service = createServiceClient();

    // Log the request (insert a row) regardless of outcome.
    const { error: insertError } = await service
      .from("guest_preview_limits")
      .insert({ ip_address: ipAddress });

    if (insertError) {
      console.error("Failed to log guest preview request", insertError);
    }

    // Check count in the last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count, error: countError } = await service
      .from("guest_preview_limits")
      .select("*", { count: "exact", head: true })
      .eq("ip_address", ipAddress)
      .gte("created_at", oneHourAgo);

    if (countError) {
      console.error("Failed to count guest preview limits", countError);
    }

    // If 3 or more (we just inserted one, so it should be > 3 to limit if we allow 3 max)
    // Actually, if we allow 3 previews, and we just inserted the 4th, count will be 4.
    // So if count > 3, reject.
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

    // Look up their twin_profiles row
    const { data: twinProfile } = await service
      .from("twin_profiles")
      .select("goals, deal_preferences")
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

    // 6. Build structured prompt
    const prompt = `You are the AI Twin screening engine for ${profile.display_name}.
A visitor just pitched ${profile.display_name}'s AI Twin with this proposal:
"${context}"

${profile.display_name}'s Profile Specs:
- Goals: ${twinProfile.goals || "Not specified"}
- Deal Preferences: ${twinProfile.deal_preferences || "Not specified"}

Evaluate mutual fit and return ONLY a valid JSON object in this exact schema, with no markdown code blocks:
{
  "score": <integer between 45 and 96 representing mutual synergy percentage>,
  "headline": "<punchy 4-8 word title summarizing the fit>",
  "green_flag": "<one crisp sentence explaining why this partnership/deal works>",
  "fit_note": "<one constructive sentence on working style, timeline, or scope to align on>",
  "win_win": "<one high-leverage sentence in 2nd person: 'You and ${profile.display_name} could...'>",
  "first_step": "<one concise action item for the immediate next step>"
}`;

    // 7. Call Gemini
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

    if (
      parsed &&
      typeof parsed.score === "number" &&
      typeof parsed.win_win === "string"
    ) {
      return NextResponse.json({
        score: Math.max(30, Math.min(98, Math.round(parsed.score))),
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
      score: 75,
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
