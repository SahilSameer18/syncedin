import { ImageResponse } from "next/og";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs"; // service client needs node runtime
export const alt = "Your twin started a conversation on SyncedIn";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const RESERVED = new Set([
  "api",
  "auth",
  "dashboard",
  "onboarding",
  "login",
  "conversations",
  "privacy",
  "terms"
]);

function shortName(title: string): string {
  return (
    title?.split(/[-|,(·]/)[0]?.trim() ||
    "you"
  );
}

/**
 * Pull the most specific observation snippet out of the personalized
 * landing-page opener so the OG card can read like a real cold reach:
 *   "Jackson saw your founding engineer work on WorkableCafes.com..."
 * instead of the generic "I'm Jackson — my twin already drafted an opener
 * for yours."
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
function observationSnippet(starter: string | null | undefined): string {
  const s = (starter ?? "").trim();
  if (!s) return "";
  // Strip leading greeting (best-effort — Claude almost always starts the
  // landing message with "Hey {firstName} — {sender} here.")
  const noGreeting = s.replace(
    /^hey\s+[A-Za-z][A-Za-z'.-]*\s*[—–-]\s*[^.!?]+[.!?]\s*/i,
    ""
  );
  // Also strip a softer "{firstName}, " greeting if present.
  const noComma = noGreeting.replace(/^[A-Za-z][A-Za-z'.-]+,\s+/, "");
  // First sentence.
  const sentences = noComma.split(/(?<=[.!?])\s+/);
  let first = (sentences[0] ?? "").trim();
  if (!first) return "";
  // Drop "I noticed " / "I saw " / "What caught my eye is " filler.
  first = first
    .replace(/^(i\s+(noticed|saw|love|loved|like|liked)\s+(that\s+)?)/i, "")
    .replace(/^(what\s+caught\s+my\s+eye\s+is\s+(that\s+)?)/i, "")
    .replace(/\s+caught\s+my\s+eye\.?$/i, "")
    .trim();
  // Normalize first letter lowercase (it sits mid-sentence in the template).
  if (first.length > 0 && /[A-Z]/.test(first[0])) {
    first = first[0].toLowerCase() + first.slice(1);
  }
  // Make sure it starts with a possessive — "your X" reads naturally after
  // "saw". If the snippet doesn't already, prepend "your".
  if (!/^(your|the|how)\b/i.test(first)) {
    first = "your " + first;
  }
  // Truncate cleanly.
  const HARD = 130;
  if (first.length > HARD) {
    const cut = first.slice(0, HARD);
    const lastSpace = cut.lastIndexOf(" ");
    first = (lastSpace > 80 ? cut.slice(0, lastSpace) : cut).trim();
  }
  // Strip trailing punctuation so the template's continuation reads
  // naturally: "{name} saw {snippet}, and is ready..."
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

export default async function InviteOgImage({
  params
}: {
  params: { slug: string };
}) {
  const slug = (params.slug || "").toLowerCase();
  const SITE_URL =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "https://syncedin.org";

  // If reserved or no record, fall back to the site-wide image-y layout.
  let inviterName = "Your twin";
  let personName = "you";
  let recipientAvatar: string | null = null;
  let inviterAvatar: string | null = null;
  let starter: string = "";
  if (!RESERVED.has(slug)) {
    try {
      const service = createServiceClient();
      const { data: invite } = await service
        .from("pending_invites")
        .select(
          "inviter_user_id, person_title, recipient_avatar_url, conversation_starter, outbound_message"
        )
        .eq("slug", slug)
        .maybeSingle();
      if (invite) {
        personName = shortName(invite.person_title ?? "you");
        recipientAvatar =
          (invite as any).recipient_avatar_url || null;
        // Prefer the long landing-page message (scrape-driven Claude prose)
        // over the short templated outbound DM for the snippet source.
        starter =
          ((invite as any).conversation_starter as string) ||
          ((invite as any).outbound_message as string) ||
          "";
        const { data: inviter } = await service
          .from("profiles")
          .select("display_name, email, avatar_url")
          .eq("id", invite.inviter_user_id)
          .maybeSingle();
        inviterName =
          inviter?.display_name ||
          inviter?.email?.split("@")[0] ||
          "Their twin";
        inviterAvatar = (inviter as any)?.avatar_url || null;
      }
    } catch {
      /* fall through with defaults */
    }
  }

  const snippet = observationSnippet(starter);
  const copy = buildInviteCopy({
    inviterFullName: inviterName,
    recipientShortName: personName,
    snippet
  });
  // Initials fallback for when the LinkedIn scrape didn't surface a photo.
  // Two letters from the person_title so the card always renders a face-
  // shaped placeholder rather than a blank gap.
  const initials =
    personName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "??";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          // Placeholder gradient — Jack is picking from 4 background
          // mockups before we lock the style. Update this block once a
          // variant is chosen.
          background:
            "linear-gradient(135deg, #f5f7ff 0%, #ffffff 50%, #f3eefe 100%)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "70px 90px",
          fontFamily: "Inter, system-ui, sans-serif"
        }}
      >
        {/* TOP ROW — real SyncedIn wordmark on the left, recipient avatar
            on the right (with inviter avatar nested smaller below). This
            replaces the old "tall stack of logo, then avatars, then
            headline" layout that ate vertical space and made the body
            text feel small. Wordmark image is served from /public, so
            Satori loads it from the deployed URL. */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%"
          }}
        >
          <img
            src={`${SITE_URL}/syncedin-wordmark-tight.png`}
            alt="SyncedIn"
            height={86}
            style={{ height: 86, width: "auto" }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
            {recipientAvatar ? (
              <img
                src={recipientAvatar}
                width={120}
                height={120}
                style={{
                  width: 120,
                  height: 120,
                  borderRadius: 60,
                  border: "5px solid #ffffff",
                  boxShadow: "0 12px 32px -10px rgba(58,77,255,0.5)",
                  objectFit: "cover"
                }}
              />
            ) : (
              <div
                style={{
                  width: 120,
                  height: 120,
                  borderRadius: 60,
                  border: "5px solid #ffffff",
                  boxShadow: "0 12px 32px -10px rgba(58,77,255,0.5)",
                  background:
                    "linear-gradient(135deg, #1f8bff, #6b2dc9)",
                  color: "#ffffff",
                  fontSize: 46,
                  fontWeight: 800,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                {initials}
              </div>
            )}
            {inviterAvatar && (
              <img
                src={inviterAvatar}
                width={72}
                height={72}
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 36,
                  border: "4px solid #ffffff",
                  boxShadow: "0 8px 24px -8px rgba(139,61,255,0.45)",
                  objectFit: "cover",
                  marginLeft: -18
                }}
              />
            )}
          </div>
        </div>

        {/* HEADLINE + BODY — bigger now that the top row is one band. */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 64,
              fontWeight: 800,
              color: "#0a0c14",
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
              maxWidth: 1020,
              display: "flex"
            }}
          >
            {copy.headline}
          </div>
          <div
            style={{
              marginTop: 28,
              fontSize: 32,
              color: "#434a5e",
              lineHeight: 1.35,
              maxWidth: 1020,
              display: "flex"
            }}
          >
            {copy.body}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      headers: {
        // Apple's link preview service refuses to cache images served
        // with no-store / private headers. Without this header Vercel
        // applies a private-no-store default to dynamic routes and
        // iMessage falls back to the favicon.
        "cache-control":
          "public, immutable, no-transform, max-age=86400"
      }
    }
  );
}
