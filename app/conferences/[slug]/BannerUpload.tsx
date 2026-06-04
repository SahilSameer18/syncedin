"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * BannerUpload — owner-only. Click/drag an image; it's cover-cropped to
 * 1200×630 (the OG aspect) as a JPEG data URL and saved to
 * conferences.cover_url, which also becomes the meta/OG image. Mirrors the
 * avatar data-URL pattern (no storage bucket needed).
 */
export function BannerUpload({
  slug,
  initialUrl
}: {
  slug: string;
  initialUrl: string | null;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState<string | null>(initialUrl);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleFile(file: File) {
    setErr(null);
    if (!file.type.startsWith("image/")) {
      setErr("That doesn't look like an image.");
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setErr("Image is over 12MB — try a smaller one.");
      return;
    }
    setBusy(true);
    try {
      const dataUrl = await resizeCover(file, 1200, 630, 0.82);
      const res = await fetch(`/api/communities/${slug}/banner`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cover_url: dataUrl })
      });
      const j = await res.json().catch(() => ({}) as any);
      if (!res.ok || j?.error) {
        throw new Error(j?.detail || j?.error || "Upload failed.");
      }
      setUrl(dataUrl);
      router.refresh();
    } catch (e: any) {
      setErr(e?.message || "Couldn't save that image.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginTop: 8 }}>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="retro-btn text-xs"
          style={{ padding: "6px 12px", fontWeight: 700 }}
        >
          {busy ? "Uploading…" : url ? "📷 Replace banner" : "📷 Upload banner"}
        </button>
        {url && (
          <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
            Also used as the share/preview image.
          </span>
        )}
      </div>
      {err && (
        <div style={{ fontSize: 11, color: "var(--red, #ef4444)", marginTop: 4 }}>
          {err}
        </div>
      )}
    </div>
  );
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

/** Cover-crop a file to w×h and return a JPEG data URL. */
async function resizeCover(
  file: File,
  w: number,
  h: number,
  quality: number
): Promise<string> {
  const img = await loadImage(file);
  const targetRatio = w / h;
  const srcRatio = img.width / img.height;
  let sw = img.width;
  let sh = img.height;
  let sx = 0;
  let sy = 0;
  if (srcRatio > targetRatio) {
    // source wider → crop sides
    sw = img.height * targetRatio;
    sx = (img.width - sw) / 2;
  } else {
    // source taller → crop top/bottom
    sh = img.width / targetRatio;
    sy = (img.height - sh) / 2;
  }
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
  return c.toDataURL("image/jpeg", quality);
}
