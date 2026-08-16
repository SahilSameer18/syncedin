import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { anthropic, TWIN_MODEL } from "@/lib/anthropic";

/**
 * Generate draft answers for the Refine step questions based on whatever
 * the user has already given us (goals + ai_export_blob + name + city).
 *
 * The user can then accept/edit each draft instead of staring at three
 * blank textareas. Aim for high-signal one-paragraph answers that read
 * like the user could have written them.
 *
 * The Refine fields target useful conversation seeds — not generic
 * networking small talk. We want answers that help two twins surface
 * win-wins faster:
 *   - asks         : what the user concretely wants from the network now
 *   - offers       : what they can give in return / what they're known for
 *   - non_negotiables: deal-breakers the twin should enforce
 *
 * Returns JSON: { asks, offers, non_negotiables, communication_style }.
 * The wizard maps these to the existing fields:
 *   asks            → goals (already filled, used only for cross-ref)
 *   offers          → deal_preferences  (what makes you say YES)
 *   communication_style → communication_style
 *   non_negotiables → deal_breakers
 */
export async function POST(req: Request) {
  const sb = createClient();
  const {
    data: { user }
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: {
    display_name?: string;
    goals?: string;
    ai_export_blob?: string;
    current_city?: string;
    hometown?: string;
    existing?: {
      deal_preferences?: string;
      communication_style?: string;
      deal_breakers?: string;
    };
  } = {};
  try {
    body = await req.json();
  } catch {
    /* empty body is fine */
  }

  const name = (body.display_name || "").trim();
  const goals = (body.goals || "").trim();
  const blob = (body.ai_export_blob || "").trim();
  // Don't run for users with literally zero signal — would just
  // produce generic platitudes.
  if (!name && !goals && blob.length < 40) {
    return NextResponse.json({
      deal_preferences: "",
      communication_style: "",
      deal_breakers: ""
    });
  }

  const system = `You draft four specific, useful answers about a user based on context they've provided (AI memory dump, goals, name, location). Each answer is what THEY would say about themselves in first-person, in their authentic voice. The user will review/edit, so prioritize concreteness over politeness.

Output STRICT JSON:
{
  "deal_preferences": "<2-3 sentences. What they can OFFER the network right now. Concrete value: warm intros, funding, architecture advice, growth hacks, angel checks.>",
  "communication_style": "<2-3 sentences. How their twin should SHOW UP: direct vs diplomatic, pushback level, fast-paced vs considered.>",
  "deal_breakers": "<2-3 sentences. What makes them immediately WALK AWAY: agency spam, pitch decks before a conversation, vague networking, uninvited sales.>",
  "achievements": "<2-4 bullet points or lines. Greatest life & career proof points: companies built, rounds raised, key metrics hit, recognizable milestones.>"
}

Rules:
- First person, concrete, specific to the user's stated background.
- NO markdown formatting other than simple line breaks. NO emojis, NO hashtags.
- If existing draft is provided, refine and sharpen it.
- Return ONLY the valid JSON object.`;

  const userContent = `User context:
Name: ${name || "(unspecified)"}
Current goals: ${goals || "(none stated)"}
Location: ${body.current_city || body.hometown || "(unspecified)"}
About-me / AI memory dump (raw): ${blob.slice(0, 3000) || "(none)"}

Existing drafts:
- deal_preferences: ${body.existing?.deal_preferences || "(empty)"}
- communication_style: ${body.existing?.communication_style || "(empty)"}
- deal_breakers: ${body.existing?.deal_breakers || "(empty)"}

Return the JSON now.`;

  try {
    const r = await anthropic.messages.create({
      model: TWIN_MODEL,
      max_tokens: 1000,
      system,
      messages: [{ role: "user", content: userContent }]
    });
    const text = r.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join("")
      .trim();
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1) {
      return NextResponse.json({
        deal_preferences: "",
        communication_style: "",
        deal_breakers: "",
        achievements: ""
      });
    }
    const parsed = JSON.parse(text.slice(start, end + 1)) as {
      deal_preferences?: string;
      communication_style?: string;
      deal_breakers?: string;
      achievements?: string;
    };
    return NextResponse.json({
      deal_preferences: (parsed.deal_preferences || "").trim(),
      communication_style: (parsed.communication_style || "").trim(),
      deal_breakers: (parsed.deal_breakers || "").trim(),
      achievements: (parsed.achievements || "").trim()
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        deal_preferences: "",
        communication_style: "",
        deal_breakers: "",
        achievements: "",
        error: String(e?.message ?? e)
      },
      { status: 200 }
    );
  }
}