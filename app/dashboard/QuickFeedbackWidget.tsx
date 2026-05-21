"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Bottom-of-dashboard feedback capture. Drag-drop a screenshot, type
 * what's broken or missing, fire it off. The point isn't to compete
 * with the public /feedback Canny page — it's to lower the friction
 * for Jack-style real-time bug reports while he's mid-flow on the
 * app. The widget always shows the same thank-you string so users
 * know it went through.
 *
 * Image handling: we resize to <=1200px on the longest edge and
 * encode as JPEG data URL on the client so the request body stays
 * under the 600KB cap the API enforces. Anything bigger gets dropped
 * server-side with a console warning rather than blocking the submit.
 */
export function QuickFeedbackWidget({
  surface = "dashboard"
}: {
  surface?: string;
}) {
  const [message, setMessage] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageMeta, setImageMeta] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string>("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setErr("That doesn't look like an image — try a PNG or JPG.");
      return;
    }
    setErr("");
    try {
      const url = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      // Downsize for upload — load into Image, canvas-resize, re-export.
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = url;
      });
      const max = 1200;
      let { width, height } = img;
      if (width > max || height > max) {
        const r = max / Math.max(width, height);
        width = Math.round(width * r);
        height = Math.round(height * r);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas-unavailable");
      ctx.drawImage(img, 0, 0, width, height);
      const small = canvas.toDataURL("image/jpeg", 0.82);
      setImageDataUrl(small);
      setImageMeta(
        `${width}×${height} · ${(small.length / 1024).toFixed(0)} KB`
      );
    } catch {
      setErr("Couldn't read that image. Try a different file?");
    }
  }, []);

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) void handleFile(f);
  }

  function onPaste(e: React.ClipboardEvent) {
    const f = Array.from(e.clipboardData.items).find((i) =>
      i.type.startsWith("image/")
    );
    if (!f) return;
    const file = f.getAsFile();
    if (file) void handleFile(file);
  }

  async function submit() {
    if (!message.trim()) {
      setErr("Type a quick note about what's working / not working.");
      return;
    }
    setSubmitting(true);
    setErr("");
    try {
      const res = await fetch("/api/feedback/quick", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: message.trim(),
          image_data_url: imageDataUrl,
          surface
        })
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.detail || j.error || `HTTP ${res.status}`);
      }
      setSent(true);
      setMessage("");
      setImageDataUrl(null);
      setImageMeta("");
    } catch (e: any) {
      setErr(e?.message || "Couldn't send. Try again in a moment.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="qfw-wrap">
      <style>{`
        .qfw-wrap {
          margin-top: 40px;
          padding: 24px;
          border-radius: 22px;
          border: 1px solid var(--border);
          background:
            radial-gradient(440px 200px at 100% 0%, rgba(255, 176, 32, 0.06), transparent 70%),
            linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0));
        }
        .qfw-header {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 14px;
        }
        .qfw-title {
          font-size: 16px;
          font-weight: 800;
          letter-spacing: -0.005em;
        }
        .qfw-sub {
          font-size: 12px;
          color: var(--text-dim);
        }
        .qfw-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          gap: 12px;
        }
        @media (min-width: 760px) {
          .qfw-row {
            grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
          }
        }
        .qfw-textarea {
          width: 100%;
          min-height: 110px;
          padding: 12px 14px;
          font-size: 14px;
          line-height: 1.5;
          border-radius: 12px;
          border: 1px solid var(--border);
          background: rgba(0, 0, 0, 0.25);
          color: var(--text);
          resize: vertical;
          font-family: inherit;
        }
        .qfw-textarea:focus {
          outline: none;
          border-color: var(--amber-bright);
          background: rgba(0, 0, 0, 0.4);
        }
        .qfw-drop {
          border: 1px dashed var(--border);
          border-radius: 12px;
          padding: 16px;
          min-height: 110px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          gap: 6px;
          font-size: 12px;
          color: var(--text-dim);
          background: rgba(0, 0, 0, 0.18);
          cursor: pointer;
          transition: all 0.15s ease;
          position: relative;
          overflow: hidden;
        }
        .qfw-drop:hover, .qfw-drop.over {
          border-color: var(--amber-bright);
          background: rgba(255, 176, 32, 0.06);
          color: var(--text);
        }
        .qfw-thumb {
          position: absolute;
          inset: 6px;
          border-radius: 8px;
          overflow: hidden;
          background: #000;
        }
        .qfw-thumb img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          opacity: 0.85;
        }
        .qfw-thumb-clear {
          position: absolute;
          top: 6px;
          right: 6px;
          background: rgba(0,0,0,0.8);
          color: #fff;
          border: 0;
          width: 24px;
          height: 24px;
          border-radius: 12px;
          font-size: 14px;
          cursor: pointer;
        }
        .qfw-actions {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-top: 14px;
          flex-wrap: wrap;
        }
        .qfw-send {
          padding: 11px 18px;
          font-size: 14px;
          font-weight: 800;
          border-radius: 10px;
        }
        .qfw-thanks {
          padding: 22px;
          text-align: center;
          background: rgba(34, 197, 94, 0.06);
          border: 1px solid rgba(34, 197, 94, 0.25);
          border-radius: 16px;
        }
        .qfw-thanks h4 {
          font-size: 18px;
          font-weight: 800;
          margin: 0 0 6px;
          color: #4ade80;
        }
        .qfw-thanks p {
          font-size: 13px;
          color: var(--text-dim);
          line-height: 1.5;
          margin: 0;
          max-width: 440px;
          margin: 0 auto;
        }
        .qfw-thanks .again {
          margin-top: 16px;
          font-size: 12px;
          color: var(--text-dim);
          text-decoration: underline;
          background: transparent;
          border: 0;
          cursor: pointer;
        }
        .qfw-err {
          font-size: 12px;
          color: #ef4444;
          margin-top: 8px;
        }
      `}</style>

      <div className="qfw-header">
        <div>
          <div className="qfw-title">Tell us what&apos;s broken or missing</div>
          <div className="qfw-sub">
            Drop a screenshot, paste, or just type. Jack reads every one.
          </div>
        </div>
      </div>

      {sent ? (
        <div className="qfw-thanks">
          <h4>✓ Got it — thank you.</h4>
          <p>
            A real human + the SyncedIn twin both read your note. If it&apos;s
            actionable, you&apos;ll usually see it shipped in the next
            build. If you left contact info we&apos;ll follow up directly.
          </p>
          <button
            type="button"
            className="again"
            onClick={() => setSent(false)}
          >
            send another
          </button>
        </div>
      ) : (
        <div onPaste={onPaste}>
          <div className="qfw-row">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, 3000))}
              placeholder="What just confused you? What would make this 10× better? Anything that broke?"
              className="qfw-textarea"
            />

            <div
              className={`qfw-drop ${dragOver ? "over" : ""}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleFile(f);
                }}
              />
              {imageDataUrl ? (
                <>
                  <div className="qfw-thumb">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imageDataUrl} alt="" />
                  </div>
                  <button
                    type="button"
                    className="qfw-thumb-clear"
                    onClick={(e) => {
                      e.stopPropagation();
                      setImageDataUrl(null);
                      setImageMeta("");
                    }}
                    aria-label="remove screenshot"
                  >
                    ×
                  </button>
                  <div
                    style={{
                      position: "absolute",
                      bottom: 8,
                      left: 8,
                      right: 8,
                      fontSize: 10,
                      color: "#fff",
                      textShadow: "0 1px 2px rgba(0,0,0,0.8)",
                      letterSpacing: "0.04em"
                    }}
                  >
                    {imageMeta}
                  </div>
                </>
              ) : (
                <>
                  <span style={{ fontSize: 20 }} aria-hidden="true">
                    🖼
                  </span>
                  <span>Drop / paste / click to add a screenshot</span>
                  <span style={{ fontSize: 10, opacity: 0.7 }}>
                    Resized to 1200px before sending. Optional.
                  </span>
                </>
              )}
            </div>
          </div>

          {err && <div className="qfw-err">{err}</div>}

          <div className="qfw-actions">
            <button
              type="button"
              onClick={submit}
              disabled={submitting || !message.trim()}
              className="retro-btn retro-btn-primary qfw-send"
            >
              {submitting ? "sending…" : "send to Jack"}
            </button>
            <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
              Sent privately. Not posted anywhere. Tagged{" "}
              <code style={{ fontSize: 11 }}>{surface}</code>.
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
