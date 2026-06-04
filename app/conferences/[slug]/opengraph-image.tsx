import { ImageResponse } from "next/og";
import { createServiceClient } from "@/lib/supabase/server";

// Service client needs the node runtime.
export const runtime = "nodejs";
export const alt = "Join this room on SyncedIn";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * OG/share image for community + conference pages. Uses the creator's
 * uploaded banner (conferences.cover_url) as the background, with the
 * room name + "Join · Sync with the network." overlaid. Jack: "that
 * banner can also become the meta image … put the name of their
 * community in that meta image, and it can say 'Join' and 'Sync with the
 * network.'"
 *
 * /communities/<slug> rewrites to /conferences/<slug>, so this single OG
 * route serves both URL shapes.
 */
export default async function OgImage({
  params
}: {
  params: { slug: string };
}) {
  const slug = (params.slug || "").toLowerCase();
  let name = "A SyncedIn room";
  let cover: string | null = null;
  let kind = "conference";
  try {
    const service = createServiceClient();
    const { data } = await service
      .from("conferences")
      .select("name, cover_url, kind")
      .eq("slug", slug)
      .maybeSingle();
    if (data) {
      name = (data.name as string) || name;
      cover = (data.cover_url as string | null) ?? null;
      kind = (data.kind as string) || "conference";
    }
  } catch {
    /* fall back to defaults */
  }

  const kindLabel = kind === "community" ? "Community" : "Conference";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: "#0b0f1e",
          fontFamily: "sans-serif"
        }}
      >
        {/* Banner background */}
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt=""
            width={1200}
            height={630}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover"
            }}
          />
        ) : (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              background:
                "linear-gradient(135deg, #1f59ff 0%, #6b2dc9 60%, #9333ea 100%)"
            }}
          />
        )}
        {/* Darkening overlay so text always reads */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            background:
              "linear-gradient(180deg, rgba(8,11,24,0.35) 0%, rgba(8,11,24,0.82) 100%)"
          }}
        />
        {/* Content */}
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: 64,
            width: "100%",
            height: "100%"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                fontSize: 30,
                fontWeight: 800,
                color: "#ffffff",
                letterSpacing: "-0.01em"
              }}
            >
              Synced<span style={{ color: "#f59e0b" }}>In</span>
            </div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: "rgba(255,255,255,0.8)",
                textTransform: "uppercase",
                letterSpacing: "0.16em"
              }}
            >
              · {kindLabel}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div
              style={{
                fontSize: 72,
                fontWeight: 800,
                color: "#ffffff",
                lineHeight: 1.05,
                letterSpacing: "-0.02em",
                maxWidth: 1000,
                display: "flex"
              }}
            >
              {name}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "14px 30px",
                  borderRadius: 14,
                  background:
                    "linear-gradient(135deg, #ffb800 0%, #f59e0b 100%)",
                  color: "#0b0f1e",
                  fontSize: 30,
                  fontWeight: 800
                }}
              >
                Join →
              </div>
              <div
                style={{
                  fontSize: 30,
                  fontWeight: 700,
                  color: "#ffffff"
                }}
              >
                Sync with the network.
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
