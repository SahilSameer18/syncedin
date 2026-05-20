import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { anthropic, TWIN_MODEL } from "@/lib/anthropic";
import { scrapePublicProfile } from "@/lib/scrape";
import type { Profile, TwinProfile } from "@/lib/types";

/**
 * Mass-generate personalized invite landing pages for a list of contacts.
 *
 * Body shape:
 *   { contacts: [{ name?, email?, handle?, note? }, ...] }
 *
 * For each, we:
 *   - Slugify their name (or email local-part, or handle)
 *   - Ensure slug uniqueness (append a random suffix on collision)
 *   - Generate ONE quick conversation-starter via Claude that includes the
 *     person's name. We use a single batched call for all contacts to keep
 *     it fast and cheap.
 *   - Insert into pending_invites
 *
 * Returns: { results: [{ contact, slug, url, starter }, ...] }
 */

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function nameFromEmail(email: string): string {
  const local = email.split("@")[0] || "";
  // Split on common separators, capitalize each word.
  return local
    .split(/[._\-+]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

type Contact = {
  name?: string;
  email?: string;
  phone?: string;
  handle?: string;
  note?: string;
  /** LinkedIn / X / Instagram / Facebook profile URL — scraped to
   *  personalize the conversation_starter. */
  profile_url?: string;
};

export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { contacts?: Contact[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const rawContacts = (body.contacts ?? []).slice(0, 100);
  // Normalize: derive a name for each
  function nameFromProfileUrl(url: string): string {
    try {
      const u = new URL(url);
      const seg = u.pathname
        .split("/")
        .filter(Boolean)
        .filter((s) => s !== "in")
        .pop();
      if (!seg) return "";
      // LinkedIn often appends a 6-10 char alphanumeric ID suffix to
      // its /in/<handle> slug when the basename collides — e.g.
      // /in/nick-linck-417b0ba. The old regex `\d+$` only stripped pure
      // trailing digits, so "417b0ba" survived and "Nick Linck 417B0Ba"
      // ended up on the invite card. Strip ANY trailing dash-separated
      // segment that mixes letters and digits (a name part never does).
      let cleaned = seg
        .replace(/-+[a-z0-9]*\d[a-z0-9]*$/i, "")
        .replace(/[-_]+/g, " ")
        .replace(/\d+$/, "")
        .replace(/\b\w/g, (c) => c.toUpperCase())
        .trim();
      // Belt-and-suspenders — after capitalization, drop any word that
      // still has a digit (handles cases where the ID wasn't dash-
      // delimited or the LinkedIn URL had unusual structure).
      cleaned = cleaned
        .split(/\s+/)
        .filter((w) => !/\d/.test(w))
        .join(" ")
        .trim();
      return cleaned;
    } catch {
      return "";
    }
  }
  const contacts = rawContacts
    .map((c) => {
      const name =
        (c.name && c.name.trim()) ||
        (c.email && nameFromEmail(c.email)) ||
        (c.handle && c.handle.replace(/^@/, "")) ||
        (c.profile_url && nameFromProfileUrl(c.profile_url)) ||
        "";
      return { ...c, name };
    })
    .filter((c) => c.name);

  // For any contact with a profile_url, scrape it (parallel). The scrape
  // becomes part of the personalization context fed to Claude when writing
  // the opener for THAT specific person — AND we now extract the real full
  // name from the scrape and rewrite the contact's name in place, so the
  // landing page says "Ryaan Aqid" instead of "Ryaanaqid" (the URL slug).
  //
  // Real-name extractor: the scraped payload looks like
  //   "handle: @ryaanaqid\nfullName: Ryaan Aqid\nbiography: ..."
  // (Apify-flattened format) or the LinkedIn page-content text usually
  // starts with the person's full name as the H1. We try several signals.
  function extractRealName(scrapeText: string): string | null {
    if (!scrapeText) return null;
    // Apify-flattened key:value lines.
    // Look for the most authoritative key first: full_name / fullName.
    // Use ASCII-only name regex (no \p{L}) since our TS target predates the
    // unicode regex flag. Common accented Latin chars (à é ñ ü) are covered
    // explicitly to handle real-world names.
    const NAME_CHAR = "[A-Za-zÀ-ÖØ-öø-ÿ'.-]";
    const NAME_WORD = `[A-ZÀ-Ö]${NAME_CHAR}+`;
    const fullNameRe = new RegExp(
      `^${NAME_WORD}(?:\\s+${NAME_CHAR}+){1,3}\\s*$`
    );
    const labelled = scrapeText.match(
      /(?:^|\n)\s*(?:full[_\s]?name|fullName|name)\s*:\s*(.+)/i
    );
    if (labelled && labelled[1]) {
      const candidate = labelled[1].split(/\n/)[0].trim().slice(0, 80);
      if (candidate && fullNameRe.test(candidate)) {
        return candidate;
      }
    }
    // ScrapingDog X / IG payloads tend to surface a "name:" line too.
    const xNameRe = new RegExp(
      `(?:^|\\n)\\s*name\\s*:\\s*(${NAME_WORD}(?:\\s+${NAME_CHAR}+){1,3})`
    );
    const xName = scrapeText.match(xNameRe);
    if (xName && xName[1]) return xName[1].trim();
    return null;
  }

  const scrapes: Record<string, string> = {};
  await Promise.all(
    contacts.map(async (c) => {
      if (!c.profile_url) return;
      try {
        const text = await scrapePublicProfile(c.profile_url);
        // Used to gate at 60 chars — that threw away sparse-but-real profiles
        // (private accounts, low-post handles) which is exactly when the
        // opener needs the scrape most. Anything non-trivial is worth
        // feeding to Claude.
        if (text && text.trim().length > 15) {
          scrapes[c.name] = text.slice(0, 2000);
          // Promote the scraped real name to the canonical name so the slug,
          // OG title, and opener all use it. Move the scrape entry under the
          // new key too.
          const real = extractRealName(text);
          if (real && real.toLowerCase() !== c.name.toLowerCase()) {
            scrapes[real] = scrapes[c.name];
            delete scrapes[c.name];
            console.log(
              `[bulk-invite] promoted name "${c.name}" → "${real}" from scrape`
            );
            c.name = real;
          }
          console.log(
            `[bulk-invite] scrape ok for ${c.name}: ${text.length} chars`
          );
        } else {
          console.warn(
            `[bulk-invite] scrape empty for ${c.name} (${c.profile_url}): ${
              text ? text.length : 0
            } chars`
          );
        }
      } catch (e) {
        // Non-fatal — opener falls back to name-only personalization.
        console.warn("[bulk-invite] scrape failed", c.profile_url, e);
      }
    })
  );

  if (contacts.length === 0) {
    return NextResponse.json({ error: "no_contacts" }, { status: 400 });
  }

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
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "https://syncedin.org";

  // Batched conversation-starter generation: one Claude call, returns JSON
  // map of {name → 3-sentence opener}.
  let starters: Record<string, string> = {};
  try {
    // PROMPT v2 — RECIPIENT-FIRST.
    //
    // The previous version produced openers like "Hey X, this is ${selfName}'s
    // twin kicking off — ${selfName} would be thrilled if his twin could
    // carry it forward — ${selfName} is looking for…" which is 100% about
    // the sender. Jack flagged this: the recipient should always come
    // first. Real cold-outreach that converts opens with something
    // specific about THEM, then segues to the bridge / proposed value.
    //
    // New structure (hard-enforced via the system prompt):
    //   Sentence 1: about the RECIPIENT — reference a real detail from
    //     their scraped profile, or if no scrape, acknowledge their work
    //     by name in a way that doesn't pretend.
    //   Sentence 2: the bridge — what overlap / win-win exists between
    //     them and ${selfName}.
    //   Sentence 3: a real question that invites their reply.
    const system = `You write SHORT cold-outreach openers from ${selfName}'s digital twin to multiple named recipients. The non-negotiable rule: every opener must LEAD with something specific about the recipient, NOT about ${selfName}. And the angle of the win-win must MATCH the recipient's professional capacity, not blindly pitch ${selfName}'s headline goal at everyone.

CRITICAL — ROLE-AWARE FRAMING:
Before writing, identify the recipient's professional capacity from their Profile block. Then match the opener accordingly. NEVER reuse ${selfName}'s single headline pitch ("looking for leaders" / "raising a round" / "hiring") for every recipient — that's robot behavior and breaks trust instantly.

If the recipient is an INVESTOR / VC / angel:
  → Lead with one of ${selfName}'s ventures or projects that fits their thesis. Frame the win-win as "this is the kind of company you back" — NOT "come operate for me." Mention the specific fund / portfolio company they're known for if it's in the Profile.

If the recipient is a FOUNDER / CEO / operator in an aligned space:
  → Lead with the overlap of what they're building and what ${selfName} is building. Propose a collaboration, intro, or specific resource trade — NOT a job pitch.

If the recipient is a POTENTIAL HIRE / candidate (the "hungry leader" type):
  → Then and ONLY then lead with the "we have projects ready to hand off" angle. This is the narrowest framing, not the default.

If the recipient is a CUSTOMER / user / community member:
  → Lead with what ${selfName} is shipping that solves their stated problem.

If the recipient is a JOURNALIST / writer / podcaster:
  → Lead with a story angle. Reference a specific piece they wrote.

If the Profile is genuinely thin (no headline, no about, no experience), DO NOT fabricate "noticed your professional path" or "your work caught my attention." Instead, open with a HONEST line: "Reaching out cold here — your name came across my radar from {platform}, and I think there might be a real overlap. {one sentence about ${selfName}'s most relevant work}. Worth a conversation?" That's better than fake-personal filler.

Return ONLY valid JSON. Each value must be a PLAIN STRING — NEVER a nested object like {"opener": "..."}. The shape is exactly:
{
  "Recipient Name One": "The opener text as a single plain string. No nesting.",
  "Recipient Name Two": "Another opener as a plain string."
}

Wrong (do NOT do this):
{
  "Lucas Chu": { "opener": "Saw your LinkedIn..." }
}

Right:
{
  "Lucas Chu": "Saw your LinkedIn..."
}

Each opener follows EXACTLY this three-beat structure:

BEAT 1 — about the RECIPIENT (always first). Reference a concrete detail from their Profile block (a project, post, line in their bio, where they work, something they shipped). If the Profile block is empty, acknowledge them by name and reference whatever signal IS present (the platform — LinkedIn / X / Instagram — or note). Never lead with "${selfName}'s twin reached out" or any variant.

BEAT 2 — the bridge (one sentence). Why their work + ${selfName}'s goals are a real win-win. Connect specific to specific.

BEAT 3 — the question (one sentence). A genuine ask that invites their reply.

Hard constraints:
- 3 sentences total. First person from ${selfName}'s twin.
- First sentence MUST be about the recipient. If it mentions ${selfName} before the recipient, the output is wrong.
- It's fine to mention that "my twin is reaching out" once, near the end of beat 2 — but never as the lead.
- NO em-dashes, NO en-dashes, NO markdown, NO bullets, NO emojis.
- If the recipient's name appears to be a URL slug (lowercase, jammed-together, e.g. "chulucas"), use just their first name in a natural casing. If unsure, skip the name and address them directly ("Saw your work on...").`;
    const userContent = `${selfName}'s goals: ${t?.goals || "(not specified)"}
${selfName}'s deal preferences: ${t?.deal_preferences || "(not specified)"}

Recipients (write one opener per recipient, keyed by the exact name shown).
Each Profile block contains what was scraped from their public footprint.
USE IT — reference at least one specific detail per opener. If a Profile
block is absent or thin, the opener should still acknowledge the recipient
in beat 1 (their name, the platform they came from, or whatever you can
infer), and only THEN mention ${selfName}.

${contacts
  .map((c) => {
    const parts: string[] = [`- ${c.name}`];
    if (c.profile_url) parts.push(`  source: ${c.profile_url}`);
    if (c.note) parts.push(`  note: ${c.note}`);
    if (scrapes[c.name]) parts.push(`  Profile:\n${scrapes[c.name]}`);
    return parts.join("\n");
  })
  .join("\n\n")}

Return the JSON object now. Remember: BEAT 1 IS ABOUT THEM, not ${selfName}.`;
    const r = await anthropic.messages.create({
      model: TWIN_MODEL,
      max_tokens: Math.min(3000, 200 + contacts.length * 120),
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
    if (start !== -1 && end !== -1) {
      const parsed = JSON.parse(text.slice(start, end + 1)) as Record<
        string,
        unknown
      >;
      // Defensive coercion: the LLM sometimes returns nested shapes like
      // { "Lucas Chu": { "opener": "Saw your..." } } instead of the flat
      // string mapping the prompt asks for. That bug shipped an opener
      // stored as a raw JSON string ({"opener":"Saw..."}) which displayed
      // on the landing page verbatim. Coerce every value to a clean
      // first-person string before passing downstream.
      starters = {};
      for (const [key, val] of Object.entries(parsed)) {
        if (typeof val === "string") {
          starters[key] = val.trim();
        } else if (val && typeof val === "object") {
          // Try common nested shapes: { opener }, { message }, { text }.
          const v = val as Record<string, unknown>;
          const candidate =
            (typeof v.opener === "string" && v.opener) ||
            (typeof v.message === "string" && v.message) ||
            (typeof v.text === "string" && v.text) ||
            "";
          if (candidate) starters[key] = (candidate as string).trim();
        }
      }
    }
  } catch (e) {
    console.error("bulk-create starters failed; falling back to template", e);
  }

  // Insert pending_invites with collision-safe slugs.
  const results: Array<{
    contact: Contact & { name: string };
    slug: string;
    url: string;
    starter: string;
  }> = [];

  for (const c of contacts) {
    const baseSlug = slugify(c.name) || "twin";
    let slug = baseSlug;
    for (let attempt = 0; attempt < 4; attempt++) {
      const { data: existing } = await service
        .from("pending_invites")
        .select("slug")
        .eq("slug", slug)
        .maybeSingle();
      if (!existing) break;
      slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
    }
    // Fallback opener (used only when Claude generation failed for this
    // specific recipient). Still tries to honor recipient-first by
    // leading with their name + a soft acknowledgment of THEIR side
    // before mentioning ${selfName}.
    const firstName = c.name.split(" ")[0];
    const starter =
      starters[c.name] ||
      `${firstName}, I saw your profile and wanted to reach out before sending a generic invite. I'm ${selfName}'s twin — there's probably a real overlap between what you're working on and what we're focused on. What would be useful for you to hear about first?`;
    // Stash the scraped profile as a highlight so the public landing page
    // can render a "we know who you are" preview.
    const highlights: string[] = [];
    if (c.note) highlights.push(c.note);
    if (scrapes[c.name]) {
      highlights.push(scrapes[c.name].slice(0, 600));
    }
    // Pull the recipient's profile photo URL out of the scraped payload so
    // the OG card can embed it. The flattened scrape format is plain text
    // with lines like "profile_image: https://..." (Apify IG path) or
    // "profile_pic_url_hd: https://..." (ScrapingDog path).
    let avatar_url: string | null = null;
    const scrape = scrapes[c.name] || "";
    if (scrape) {
      const m = scrape.match(
        /(?:^|\n)\s*(?:profile_image|profile_pic_url_hd|profile_pic_url|profilePicUrl)\s*:\s*(https?:\/\/\S+)/i
      );
      if (m && m[1]) avatar_url = m[1].trim();
    }
    await service.from("pending_invites").insert({
      slug,
      inviter_user_id: user.id,
      person_title: c.name,
      person_url: c.profile_url ?? null,
      person_highlights: highlights,
      conversation_starter: starter,
      recipient_avatar_url: avatar_url
    });
    results.push({
      contact: c,
      slug,
      url: `${appUrl}/${slug}`,
      starter
    });
  }

  return NextResponse.json({ results });
}
