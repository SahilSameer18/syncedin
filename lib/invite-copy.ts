/**
 * Shared copy helpers for the invite landing page + OG card.
 *
 * Both surfaces (the static social-preview PNG and the live HTML hero)
 * pull the same observation snippet from the personalized Claude-generated
 * landing message AND wrap it in the same "Recipient, it's time to get
 * SyncedIn." template. Centralizing here means the two never drift out
 * of sync — change the template once, both surfaces update.
 */

/**
 * Pull the most specific observation snippet out of the personalized
 * landing-page opener so the OG card and animated hero can both read like
 * a real cold reach instead of generic "my twin already drafted an
 * opener for yours" filler.
 *
 * Heuristic:
 *   1. Drop a leading "Hey {name} — {sender} here." greeting if present.
 *   2. Take the first remaining sentence.
 *   3. Normalize first-person voice into third-person noun-phrase form
 *      ("Your founding engineer work caught my eye" → "your founding
 *      engineer work").
 *   4. Truncate at a word boundary around 110 chars.
 *   5. Strip trailing punctuation so the template can chain into ", and..."
 */
export function observationSnippet(
  starter: string | null | undefined
): string {
  const s = (starter ?? "").trim();
  if (!s) return "";
  const noGreeting = s.replace(
    /^hey\s+[A-Za-z][A-Za-z'.-]*\s*[—–-]\s*[^.!?]+[.!?]\s*/i,
    ""
  );
  const noComma = noGreeting.replace(/^[A-Za-z][A-Za-z'.-]+,\s+/, "");
  const sentences = noComma.split(/(?<=[.!?])\s+/);
  let first = (sentences[0] ?? "").trim();
  if (!first) return "";
  first = first
    .replace(/^(i\s+(noticed|saw|love|loved|like|liked)\s+(that\s+)?)/i, "")
    .replace(/^(what\s+caught\s+my\s+eye\s+is\s+(that\s+)?)/i, "")
    .replace(/\s+caught\s+my\s+eye\.?$/i, "")
    .trim();
  if (first.length > 0 && /[A-Z]/.test(first[0])) {
    first = first[0].toLowerCase() + first.slice(1);
  }
  if (!/^(your|the|how)\b/i.test(first)) {
    first = "your " + first;
  }
  const HARD = 130;
  if (first.length > HARD) {
    const cut = first.slice(0, HARD);
    const lastSpace = cut.lastIndexOf(" ");
    first = (lastSpace > 80 ? cut.slice(0, lastSpace) : cut).trim();
  }
  first = first.replace(/[.,;:!?…\s]+$/g, "");
  return first;
}

export function buildInviteCopy(opts: {
  inviterFullName: string;
  recipientShortName: string;
  snippet: string;
}): { headline: string; body: string } {
  const { inviterFullName, recipientShortName, snippet } = opts;
  const headline = `${recipientShortName}, it's time to get SyncedIn.`;
  const body = snippet
    ? `${inviterFullName} saw ${snippet} — and is ready to have his agent find a plan with yours. Stay SyncedIn, together.`
    : `${inviterFullName} thinks your twin is worth a conversation with his. Spin yours up and let the two clones find the win-win. Stay SyncedIn, together.`;
  return { headline, body };
}
