import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { anthropic, TWIN_MODEL } from "@/lib/anthropic";
import { scrapePublicProfile } from "@/lib/scrape";

/**
 * Universal context-source ingestion for onboarding.
 *
 * Body shape:
 *  - { type: "url", value: "https://linkedin.com/in/..." }  any web page
 *  - { type: "raw", value: "...pasted text..." }            free paste
 *
 * Returns:
 *   { label, source, extracted_text }
 *
 * The extracted_text is a SHORT, first-person dossier rewrite ready to be
 * appended to the user's twin context. Anthropic also cleans noise like
 * navbar text, ads, and follower counts.
 */
export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { type?: string; value?: string; note?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const type = (body.type ?? "url").toLowerCase();
  const value = (body.value ?? "").trim();
  const userNote = (body.note ?? "").trim().slice(0, 1500);
  if (!value && !userNote) {
    return NextResponse.json({ error: "missing_value" }, { status: 400 });
  }

  // 1. Get the raw text we'll feed Claude.
  let rawText = "";
  let label = "";
  let source = value;

  try {
    if (type === "raw") {
      rawText = value.slice(0, 20000);
      label = "Pasted text";
      source = "manual";
    } else {
      // Anything else is treated as a URL. scrapePublicProfile tries Exa
      // first and falls back to Apify for X / Instagram which Exa can't
      // reach. If neither works the user can still paste the text below.
      rawText = await scrapePublicProfile(value);
      label = guessLabel(value);
      source = value;
    }
  } catch (e: any) {
    return NextResponse.json(
      {
        error: "fetch_failed",
        detail: e?.message ?? "Couldn't reach that source. Try pasting the text directly."
      },
      { status: 502 }
    );
  }

  if (!rawText.trim()) {
    return NextResponse.json(
      {
        error: "empty_source",
        detail:
          "Nothing usable came back from that source. Try a different URL, or paste the text directly."
      },
      { status: 422 }
    );
  }

  // 2. Ask Claude to rewrite it as a tight first-person snippet.
  //
  // Two modes:
  //  - SOCIAL profile (X / Twitter / Instagram / LinkedIn): treat the scrape
  //    as VOICE / writing-flavor signal. Preserve actual phrasing, cadence,
  //    favorite words, sentence rhythm. The output reads like the person's
  //    own voice — because the twin will be writing in that voice later.
  //  - ANY OTHER URL: extract dossier facts in clean first-person prose.
  const sourceLower = source.toLowerCase();
  const isSocial =
    /linkedin\.com|twitter\.com|x\.com|instagram\.com/.test(sourceLower);

  const system = isSocial
    ? `You're extracting a person's WRITING VOICE from their own social posts. This is style training data — NOT a summary.

Rules:
- First person ("I", "my", "I think..."). Present tense.
- Preserve the user's actual phrasing, cadence, favorite words, sentence rhythm. If they're terse, be terse. If they riff, riff. If they use lowercase or no punctuation, preserve that.
- Up to 300 words. Multiple short paragraphs are fine.
- Lead with the voice example, then a single short paragraph at the end summarizing what they care about.
- Skip filler: ads, navigation, follower counts, "Liked by", repeated brand mentions, retweet boilerplate.
- Never invent details. If the scrape is thin, return only what's supported.
- No em-dashes, no markdown, no bullets, no headers.`
    : `You convert a raw web/social scrape ABOUT a person into a short, first-person snippet they can use as twin context.

Rules:
- First person ("I", "my", "I work on..."), present tense.
- Plain prose, no markdown, no bullets, no headers, no em-dashes.
- 80 to 180 words. Cover what's known: role, focus, what they build or care about, signals about voice and values.
- Skip filler: ads, navigation text, follower counts, audience sizes, button labels, repeated brand mentions.
- If the scrape is sparse, return only what's supported by the text. Never invent details.`;

  let cleaned = "";
  try {
    const r = await anthropic.messages.create({
      model: TWIN_MODEL,
      max_tokens: 600,
      system,
      messages: [
        {
          role: "user",
          content: `Source: ${source}\n\nRaw scrape:\n${rawText.slice(0, 12000)}\n\nReturn just the cleaned first-person snippet.`
        }
      ]
    });
    cleaned = r.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join("\n")
      .replace(/\s*[—–]\s*/g, ", ")
      .trim();
  } catch (e: any) {
    return NextResponse.json(
      { error: "synth_failed", detail: e?.message ?? String(e) },
      { status: 500 }
    );
  }

  return NextResponse.json({
    label,
    source,
    extracted_text: cleaned,
    raw_chars: rawText.length
  });
}

function guessLabel(url: string): string {
  if (/linkedin\.com/i.test(url)) return "LinkedIn";
  if (/(twitter|x)\.com/i.test(url)) return "X / Twitter";
  if (/instagram\.com/i.test(url)) return "Instagram";
  if (/facebook\.com/i.test(url)) return "Facebook";
  if (/github\.com/i.test(url)) return "GitHub";
  if (/medium\.com|substack\.com/i.test(url)) return "Article";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Web";
  }
}
