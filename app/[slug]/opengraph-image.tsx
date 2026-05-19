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

export default async function InviteOgImage({
  params
}: {
  params: { slug: string };
}) {
  const slug = (params.slug || "").toLowerCase();

  // If reserved or no record, fall back to the site-wide image-y layout.
  let inviterName = "Your twin";
  let personName = "you";
  let recipientAvatar: string | null = null;
  let inviterAvatar: string | null = null;
  if (!RESERVED.has(slug)) {
    try {
      const service = createServiceClient();
      const { data: invite } = await service
        .from("pending_invites")
        .select("inviter_user_id, person_title, recipient_avatar_url")
        .eq("slug", slug)
        .maybeSingle();
      if (invite) {
        personName = shortName(invite.person_title ?? "you");
        recipientAvatar =
          (invite as any).recipient_avatar_url || null;
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

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background:
            "linear-gradient(135deg, #f5f7ff 0%, #ffffff 50%, #f3eefe 100%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "80px 100px",
          fontFamily: "Inter, system-ui, sans-serif"
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            marginBottom: 32
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 100 100"
            width="80"
            height="80"
          >
            <defs>
              <linearGradient id="slug_g" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#1f8bff" />
                <stop offset="55%" stopColor="#3a4dff" />
                <stop offset="100%" stopColor="#8b3dff" />
              </linearGradient>
            </defs>
            <path
              d="M 32 10 L 68 10 Q 92 14 92 50 Q 92 86 68 90 L 32 90 Q 8 86 8 50 Q 8 14 32 10 Z"
              fill="none"
              stroke="url(#slug_g)"
              strokeWidth="11"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <circle cx="38" cy="50" r="6.5" fill="#1f3bce" />
            <circle cx="62" cy="50" r="6.5" fill="#6b2dc9" />
          </svg>
          <div
            style={{
              fontSize: 44,
              fontWeight: 800,
              letterSpacing: "-0.02em",
              color: "#0a0c14",
              display: "flex"
            }}
          >
            Synced<span style={{ color: "#3a4dff" }}>In</span>
          </div>
        </div>

        {/* Interlocked avatars: recipient on the LEFT (face they recognize),
            inviter on the right. Falls back to a placeholder ring if either
            avatar URL is missing. Satori renders <img src="https://..."/>
            inline as long as the host serves CORS-friendly bytes. */}
        {(recipientAvatar || inviterAvatar) && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginBottom: 28,
              marginTop: -4
            }}
          >
            {recipientAvatar && (
              <img
                src={recipientAvatar}
                width={108}
                height={108}
                style={{
                  width: 108,
                  height: 108,
                  borderRadius: 54,
                  border: "4px solid #ffffff",
                  boxShadow: "0 8px 24px -8px rgba(58,77,255,0.45)",
                  objectFit: "cover"
                }}
              />
            )}
            {recipientAvatar && inviterAvatar && (
              <div
                style={{
                  width: 14,
                  height: 4,
                  background: "#5e6eff",
                  margin: "0 -8px",
                  borderRadius: 2,
                  zIndex: 1
                }}
              />
            )}
            {inviterAvatar && (
              <img
                src={inviterAvatar}
                width={88}
                height={88}
                style={{
                  width: 88,
                  height: 88,
                  borderRadius: 44,
                  border: "4px solid #ffffff",
                  boxShadow: "0 8px 24px -8px rgba(139,61,255,0.45)",
                  objectFit: "cover",
                  marginLeft: recipientAvatar ? 0 : 0
                }}
              />
            )}
          </div>
        )}

        <div
          style={{
            fontSize: 76,
            fontWeight: 800,
            color: "#0a0c14",
            lineHeight: 1.02,
            letterSpacing: "-0.025em",
            maxWidth: 1000,
            display: "flex"
          }}
        >
          {personName}, your digital twin awaits.
        </div>
        <div
          style={{
            marginTop: 26,
            fontSize: 30,
            color: "#434a5e",
            lineHeight: 1.35,
            maxWidth: 1000,
            display: "flex"
          }}
        >
          I&apos;m {inviterName} — my twin already drafted an opener for
          yours. Sign up and let your clone reply. Two twins find the
          win-win before our calendars ever do.
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
