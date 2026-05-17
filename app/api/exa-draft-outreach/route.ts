import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { anthropic, TWIN_MODEL } from "@/lib/anthropic";
import type { Profile, TwinProfile } from "@/lib/types";

/**
 * The current user's twin drafts a short, personalized reach-out to a person
 * Exa surfaced. ALSO:
 *  - Generates a unique slug (e.g. "lucas-chu")
 *  - Generates an opening conversation message from the user's twin
 *  - Stores both in pending_invites so the invitee can land at
 *    syncedin.org/<slug>, see the auto-started conversation, and sign up to
 *    reply with their own twin
 *  - Appends the personal invite URL to the outreach message
 *
 * Hard rules in the outreach prose:
 *  - No em-dashes (—) anywhere
 *  - Be specific about WHY they're a fit, drawn from the highlights
 *  - Mention the platform suggested the match and an auto-generated convo
 *    waits at the link
 */

// Slugify a person's name: take first 2-3 words before any separator,
// lowercase, alphanumeric + hyphens only.
function slugify(name: string): string {
  const firstChunk = name.split(/[-|,(·]/)[0] || name;
  const base = firstChunk
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || "twin";
}

// Strip em-dashes and en-dashes from generated text (defense in depth on top
// of the prompt instruction).
function stripDashes(s: string): string {
  return s
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/,\s*,/g, ",")
    .trim();
}

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
  const personUrl = (body.person_url ?? "").trim();

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

  // Unique slug for the landing page. If taken, append a short hash.
  const baseSlug = slugify(personTitle);
  let slug = baseSlug;
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: existing } = await service
      .from("pending_invites")
      .select("slug")
      .eq("slug", slug)
      .maybeSingle();
    if (!existing) break;
    slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "https://syncedin.org";
  const inviteUrl = `${appUrl}/${slug}`;

  const longSystemPrompt = `You are the digital twin of ${selfName}, writing a first outreach message to invite someone to connect on SyncedIn (an agent-to-agent protocol where two people's digital twins explore the highest-leverage win-win between them).

# Who you are representing
Name: ${selfName}
Goals: ${t?.goals || "(not specified)"}
Deal preferences: ${t?.deal_preferences || "(not specified)"}
Communication style: ${t?.communication_style || "(default: warm, concise, direct)"}

# Who you're reaching out to
${personTitle}
${personUrl ? `Profile: ${personUrl}` : ""}
What's known about them:
${highlights || "(only the name/role above)"}

# Personal invite link for this exact person
${inviteUrl}
(A conversation has already been auto-generated there from ${selfName}'s twin; they just need to sign up to reply with their own.)

# Hard rules — do not break these
- 3 to 5 short sentences. No long monologue.
- DO NOT use em-dashes or en-dashes anywhere. Use commas, periods, or colons instead.
- Be CONCRETE about why ${selfName} and this person are a fit. Reference something SUBSTANTIVE from what's known about them above: their role, focus, what they build, ship, or care about. Generic flattery is banned.
- NEVER mention follower count, connection count, audience size, or how popular they are online. That's low-signal noise.
- Mention that the platform suggested the match, and that a conversation has already been auto-generated from your clone at the link. Phrase it like: the recipient can sign up and their clone can pair with yours to streamline the back-and-forth.
- Include the personal invite link above (raw URL, no markdown) somewhere natural in the message.
- First person, plain text. No subject line, no signature.
- Match ${selfName}'s communication style.`;

  // Short message system prompt — for LinkedIn connection-request notes which
  // are capped at 200 characters. The link won't fit, so we don't include it.
  const shortSystemPrompt = `You are the digital twin of ${selfName}, writing a LinkedIn connection-request note to someone you don't know yet.

# Who you are representing
Name: ${selfName}
Goals: ${t?.goals || "(not specified)"}

# Who you're reaching out to
${personTitle}
What's known about them: ${highlights || "(only the name/role above)"}

# Hard rules
- MAX 195 CHARACTERS. Count them. LinkedIn cuts off anything past 200.
- 1 to 2 sentences only.
- NO em-dashes or en-dashes. NO markdown. NO subject line, NO signature.
- One specific reason ${selfName} wants to connect, drawn from what's known about them. NEVER mention follower count, connection count, or audience size.
- End on a light invitation to chat. Do NOT include a URL (it eats characters and triggers spam filters in connection notes).
- First person, plain text.`;

  let outreach = "";
  let shortNote = "";
  let convStarter = "";

  const convPrompt = `You are the digital twin of ${selfName}. Write the OPENING message of a conversation with ${personTitle}, who is about to land on a SyncedIn invite page from ${selfName}'s clone.

Context the recipient will see:
- ${selfName}'s goals: ${t?.goals || "(not specified)"}
- What's known about ${personTitle}: ${highlights || "(only the name/role above)"}

Rules:
- 2 to 4 sentences, first person, as ${selfName}'s clone speaking to ${personTitle}.
- Open with something specific you noticed about them. Never mention follower or connection count.
- Name the concrete overlap between ${selfName} and them.
- Close with a real question or proposal that invites a reply.
- NO em-dashes or en-dashes anywhere. NO markdown. Just prose.`;

  try {
    // Generate all three in parallel — long DM, 200-char connection note,
    // and the landing-page opening conversation message.
    const [r1, r2, r3] = await Promise.all([
      anthropic.messages.create({
        model: TWIN_MODEL,
        max_tokens: 600,
        system: longSystemPrompt,
        messages: [
          {
            role: "user",
            content: `Write the outreach message to ${personTitle}. Remember: no em-dashes, be specific about why they're a fit, include the invite link, mention the auto-generated conversation, never mention follower count.`
          }
        ]
      }),
      anthropic.messages.create({
        model: TWIN_MODEL,
        max_tokens: 200,
        system: shortSystemPrompt,
        messages: [
          {
            role: "user",
            content: `Write the LinkedIn connection-request note. STRICT 195 character cap. No URL. No follower count mention.`
          }
        ]
      }),
      anthropic.messages.create({
        model: TWIN_MODEL,
        max_tokens: 400,
        system: convPrompt,
        messages: [
          {
            role: "user",
            content: `Write the opening conversation message.`
          }
        ]
      })
    ]);

    outreach = r1.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join("\n")
      .trim();
    outreach = stripDashes(outreach);
    if (!outreach.includes(inviteUrl)) {
      outreach = `${outreach}\n\n${inviteUrl}`;
    }

    shortNote = r2.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join(" ")
      .trim();
    shortNote = stripDashes(shortNote);
    // Hard cap to 200 chars regardless of what the model returned.
    if (shortNote.length > 200) {
      shortNote = shortNote.slice(0, 197).trimEnd() + "...";
    }

    convStarter = r3.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join("\n")
      .trim();
    convStarter = stripDashes(convStarter);
  } catch (e: any) {
    console.error("exa-draft-outreach generation error", e);
    return NextResponse.json(
      { error: "draft_failed", detail: e?.message ?? String(e) },
      { status: 500 }
    );
  }

  // Save the pending invite so the landing page can render it.
  const { error: insertErr } = await service.from("pending_invites").insert({
    slug,
    inviter_user_id: user.id,
    person_title: personTitle,
    person_url: personUrl || null,
    person_highlights: body.highlights ?? [],
    conversation_starter: convStarter
  });
  if (insertErr) {
    console.error("pending_invites insert failed", insertErr);
    // Non-fatal — still return the outreach so the user can copy it.
  }

  return NextResponse.json({
    message: outreach,
    short_message: shortNote,
    slug,
    invite_url: inviteUrl,
    conversation_starter: convStarter
  });
}
