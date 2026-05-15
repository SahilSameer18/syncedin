import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { anthropic, TWIN_MODEL } from "@/lib/anthropic";
import type { Profile, TwinProfile } from "@/lib/types";

/**
 * The current user's twin drafts a short, personalized reach-out to a person
 * Exa surfaced — an invitation to connect on SyncedIn. The user can copy it,
 * edit it, and send it through their own channel.
 */
export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: {
    person_title?: string;
    person_url?: string;
    highlights?: string[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const personTitle = (body.person_title ?? "").trim();
  if (!personTitle) {
    return NextResponse.json({ error: "missing_person" }, { status: 400 });
  }
  const highlights = (body.highlights ?? []).join("\n");

  const service = createServiceClient();
  const [{ data: profile }, { data: twin }] = await Promise.all([
    service.from("profiles").select("*").eq("id", user.id).single(),
    service
      .from("twin_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle()
  ]);

  const p = profile as Profile;
  const t = twin as TwinProfile | null;
  const selfName = p?.display_name || p?.email || "the sender";

  const systemPrompt = `You are the digital twin of ${selfName}, writing a first outreach message to invite someone to connect on SyncedIn — an agent-to-agent protocol where two people's digital twins negotiate the highest-leverage win-win between them.

# Who you are representing
Name: ${selfName}
Goals: ${t?.goals || "(not specified)"}
Deal preferences: ${t?.deal_preferences || "(not specified)"}
Communication style: ${t?.communication_style || "(default: warm, concise, direct)"}

# Who you're reaching out to
${personTitle}
${body.person_url ? `Profile: ${body.person_url}` : ""}
What's known about them:
${highlights || "(only the name/role above)"}

# How to write it
- Short — 2 to 4 sentences. A real first message, not a pitch deck.
- Open with something specific and genuine about THEM, drawn from what's known above. No generic flattery.
- Name the concrete win-win you see between ${selfName} and them — why connecting is worth their time.
- Close with a light, low-pressure invite to connect on SyncedIn.
- Match ${selfName}'s communication style. First person. No markdown, no subject line, no signature — just the message body.`;

  try {
    const response = await anthropic.messages.create({
      model: TWIN_MODEL,
      max_tokens: 512,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Write the outreach message to ${personTitle}.`
        }
      ]
    });
    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join("\n")
      .trim();
    return NextResponse.json({ message: text });
  } catch (e: any) {
    console.error("exa-draft-outreach error", e);
    return NextResponse.json(
      { error: "draft_failed", detail: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
