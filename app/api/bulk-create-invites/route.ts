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
      return seg
        .replace(/[-_]+/g, " ")
        .replace(/\d+$/, "")
        .replace(/\b\w/g, (c) => c.toUpperCase())
        .trim();
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
  // the opener for THAT specific person.
  const scrapes: Record<string, string> = {};
  await Promise.all(
    contacts.map(async (c) => {
      if (!c.profile_url) return;
      try {
        const text = await scrapePublicProfile(c.profile_url);
        if (text && text.trim().length > 60) {
          scrapes[c.name] = text.slice(0, 2000);
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
    const system = `You write a short opening message from ${selfName}'s digital twin to multiple recipients. Return ONLY valid JSON of the shape:
{
  "<recipient name 1>": "<opener>",
  "<recipient name 2>": "<opener>",
  ...
}

Each opener:
- 2 or 3 sentences, first person, plain prose
- Greets the named recipient by their first name
- References that ${selfName}'s twin started this conversation and would love their twin to pick it up
- Ends with a real question that invites a reply
- NO em-dashes or en-dashes
- NO markdown, no headers, no bullets`;
    const userContent = `${selfName}'s goals: ${t?.goals || "(not specified)"}

Recipients (write one opener per recipient, keyed by the exact name).
Where a "Profile" block is provided, reference at least one specific detail
from it so the opener reads like ${selfName}'s twin actually looked at the
recipient's profile before writing.

${contacts
  .map((c) => {
    const parts: string[] = [`- ${c.name}`];
    if (c.note) parts.push(`  note: ${c.note}`);
    if (scrapes[c.name]) parts.push(`  Profile: ${scrapes[c.name]}`);
    return parts.join("\n");
  })
  .join("\n\n")}

Return the JSON object now.`;
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
      starters = JSON.parse(text.slice(start, end + 1)) as Record<
        string,
        string
      >;
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
    const starter =
      starters[c.name] ||
      `Hey ${c.name.split(" ")[0]}, ${selfName}'s twin would love to talk to yours. There's likely a real win-win between us. Sign up at the link and your clone can pick this up.`;
    // Stash the scraped profile as a highlight so the public landing page
    // can render a "we know who you are" preview.
    const highlights: string[] = [];
    if (c.note) highlights.push(c.note);
    if (scrapes[c.name]) {
      highlights.push(scrapes[c.name].slice(0, 600));
    }
    await service.from("pending_invites").insert({
      slug,
      inviter_user_id: user.id,
      person_title: c.name,
      person_url: c.profile_url ?? null,
      person_highlights: highlights,
      conversation_starter: starter
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
