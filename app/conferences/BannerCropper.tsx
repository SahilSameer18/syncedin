"use client";

import { useEffect, useRef, useState } from "react";

/**
 * BannerCropper — pick an image, then SEE and choose the crop before
 * saving (Jack: "allow someone to see how it's going to crop and to
 * select the part of the photo which will be shown"). The crop frame is
 * locked to the 1200×630 share aspect; the user pans (drag) and zooms
 * (slider) the photo behind it, then "Use this crop" renders the visible
 * region to a 1200×630 JPEG data URL.
 */
const OUT_W = 1200;
const OUT_H = 630;
const RATIO = OUT_H / OUT_W;

export function BannerCropper({
  currentUrl,
  onCropped,
  buttonLabel = "Upload banner"
}: {
  currentUrl?: string | null;
  onCropped: (dataUrl: string) => void;
  buttonLabel?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [frameW, setFrameW] = useState(460);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [err, setErr] = useState<string | null>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);

  const frameH = Math.round(frameW * RATIO);
  const coverScale = img
    ? Math.max(frameW / img.naturalWidth, frameH / img.naturalHeight)
    : 1;
  const dispScale = coverScale * zoom;
  const dispW = img ? img.naturalWidth * dispScale : 0;
  const dispH = img ? img.naturalHeight * dispScale : 0;

  function clamp(x: number, y: number) {
    return {
      x: Math.min(0, Math.max(frameW - dispW, x)),
      y: Math.min(0, Math.max(frameH - dispH, y))
    };
  }

  // Re-center when a new image loads or zoom changes.
  useEffect(() => {
    if (!img) return;
    setPos(clamp((frameW - dispW) / 2, (frameH - dispH) / 2));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [img, zoom, frameW]);

  // Measure the frame width so the crop math matches what's on screen.
  useEffect(() => {
    if (!img) return;
    const el = frameRef.current;
    if (el) setFrameW(el.clientWidth);
  }, [img]);

  function pick(file: File) {
    setErr(null);
    if (!file.type.startsWith("image/")) {
      setErr("Not an image.");
      return;
    }
    if (file.size > 14 * 1024 * 1024) {
      setErr("Over 14MB — try smaller.");
      return;
    }
    const image = new Image();
    image.onload = () => {
      setZoom(1);
      setImg(image);
    };
    image.onerror = () => setErr("Couldn't read that image.");
    image.src = URL.createObjectURL(file);
  }

  function onPointerDown(e: React.PointerEvent) {
    drag.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    setPos(clamp(e.clientX - drag.current.x, e.clientY - drag.current.y));
  }
  function onPointerUp() {
    drag.current = null;
  }

  function save() {
    if (!img) return;
    const sx = -pos.x / dispScale;
    const sy = -pos.y / dispScale;
    const sW = frameW / dispScale;
    const sH = frameH / dispScale;
    const c = document.createElement("canvas");
    c.width = OUT_W;
    c.height = OUT_H;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, sx, sy, sW, sH, 0, 0, OUT_W, OUT_H);
    onCropped(c.toDataURL("image/jpeg", 0.82));
    setImg(null);
  }

  return (
    <div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) pick(f);
          e.target.value = "";
        }}
      />

      {!img && (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="retro-btn text-xs"
          style={{ padding: "6px 12px", fontWeight: 700 }}
        >
          📷 {currentUrl ? "Replace banner" : buttonLabel}
        </button>
      )}

      {img && (
        <div style={{ marginTop: 4 }}>
          <div
            ref={frameRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
            style={{
              position: "relative",
              width: "100%",
              maxWidth: 480,
              height: frameH,
              overflow: "hidden",
              borderRadius: 12,
              border: "1px solid var(--border-bright)",
              background: "#000",
              cursor: drag.current ? "grabbing" : "grab",
              touchAction: "none",
              userSelect: "none"
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.src}
              alt="crop preview"
              draggable={false}
              style={{
                position: "absolute",
                left: pos.x,
                top: pos.y,
                width: dispW,
                height: dispH,
                maxWidth: "none"
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
                boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.35)"
              }}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
            <span style={{ fontSize: 11, color: "var(--text-dim)" }}>Zoom</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              style={{ flex: 1, maxWidth: 200 }}
            />
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button
              type="button"
              onClick={save}
              className="retro-btn retro-btn-primary text-xs"
              style={{ padding: "6px 12px", fontWeight: 700 }}
            >
              Use this crop
            </button>
            <button
              type="button"
              onClick={() => setImg(null)}
              className="retro-btn text-xs"
              style={{ padding: "6px 12px" }}
            >
              Cancel
            </button>
          </div>
          <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4 }}>
            Drag to reposition · zoom to frame the shot.
          </div>
        </div>
      )}
      {err && (
        <div style={{ fontSize: 11, color: "var(--red, #ef4444)", marginTop: 4 }}>
          {err}
        </div>
      )}
    </div>
  );
}
