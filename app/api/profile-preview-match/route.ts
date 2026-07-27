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
        winwin: `${profile.display_name} is still building their twin. Check back later or sign up to connect!`,
      });
    }

    // 6. Build the prompt
    const prompt = `A visitor to ${profile.display_name}'s profile pasted who they are: ${context}.
${profile.display_name}'s goals: ${twinProfile.goals || "None specified"}.
${profile.display_name}'s deal preferences: ${twinProfile.deal_preferences || "None specified"}.

Write ONE concrete, specific sentence describing a win-win between them, second person ('You and ${profile.display_name} could...'), plus a 'First step:' sentence. No invented facts.`;

    // 7. Call Gemini
    const response = await gemini.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
    });

    const text = response.text || "I couldn't generate a match right now.";

    // 8. Return
    return NextResponse.json({ winwin: text });
  } catch (err: any) {
    console.error("Guest preview error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
