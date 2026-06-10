"use client";

import { useState } from "react";
import Link from "next/link";
import { BrandLogo, type BrandKey } from "../BrandLogo";

/**
 * AiKnowsMeFunnel, the conversion engine for /ai-knows-me.
 *
 * The viral loop: copy the test prompt, ask the AI you already use, paste
 * its answer, see your Personal Intelligence decoded (real generation via
 * /api/portfolio-preview, no fake demo), then claim it or share the test.
 * The paste is stashed under the same localStorage key as the
 * /generate-free-portfolio funnel so signup → onboarding prefills the twin.
 */

const PROMPT = `Tell me everything you actually know about me. Who I am, what I'm building or working on, my goals for the next 6 to 12 months, how I think and communicate, my strengths, my blind spots, the people and projects that matter to me, and the opportunities I would say yes to instantly.

Be specific and concrete. Use exact phrases I use, real examples, and stored memories if you have them. If you don't know something, write "unknown" rather than guessing.

Structure it under these headings:
# Who I am
# What I'm working on
# Goals (next 6 to 12 months)
# How I think and communicate
# Strengths
# Blind spots
# People and projects that matter
# Opportunities I'd say yes to instantly`;

const APPS: { key: BrandKey; label: string; url: string }[] = [
  { key: "chatgpt", label: "ChatGPT", url: "https://chatgpt.com" },
  { key: "claude", label: "Claude", url: "https://claude.ai/new" },
  { key: "gemini", label: "Gemini", url: "https://gemini.google.com/app" },
  { key: "grok", label: "Grok", url: "https://grok.com" }
];

const SHARE_URL = "https://syncedin.org/ai-knows-me";
const SHARE_TEXT =
  "What does your AI actually know about you? Take the 60 second test:";

export function AiKnowsMeFunnel() {
  const [name, setName] = useState("");
  const [dump, setDump] = useState("");
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<{
    headline: string;
    about: string;
    highlights: string[];
  } | null>(null);

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(PROMPT);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      /* clipboard blocked */
    }
  }

  async function shareTest() {
    try {
      if (navigator.share) {
        await navigator.share({ text: SHARE_TEXT, url: SHARE_URL });
      } else {
        await navigator.clipboard.writeText(`${SHARE_TEXT} ${SHARE_URL}`);
      }
      setShared(true);
      setTimeout(() => setShared(false), 2200);
    } catch {
      /* share dismissed or clipboard blocked */
    }
  }

  async function decode() {
    if (dump.trim().length < 20) {
      setErr("Paste your AI's full answer first, the more the sharper.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      // Stash so signup → onboarding prefills the twin + full portfolio.
      try {
        localStorage.setItem(
          "syncedin-portfolio-seed",
          JSON.stringify({ name, dump })
        );
      } catch {
        /* storage blocked, still works, just no prefill */
      }
      const res = await fetch("/api/portfolio-preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, dump })
      });
      const j = await res.json().catch(() => ({}) as any);
      if (j?.error) {
        setErr(j.detail || "Couldn't decode that, add a little more and retry.");
        return;
      }
      setResult({
        headline: j.headline || "",
        about: j.about || "",
        highlights: Array.isArray(j.highlights) ? j.highlights : []
      });
    } catch {
      setErr("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <div className="retro-label" style={{ color: "var(--green)" }}>
          ✦ your personal intelligence, decoded
        </div>
        <div
          className="retro-panel retro-shadow"
          style={{ marginTop: 12, padding: 24 }}
        >
          <div
            style={{
              fontSize: 26,
              fontWeight: 850,
              letterSpacing: "-0.02em",
              lineHeight: 1.1,
              color: "var(--text)"
            }}
          >
            {name || "What your AI knows"}
          </div>
          {result.headline && (
            <div
              style={{
                marginTop: 8,
                fontSize: 16,
                color: "var(--amber-bright)",
                fontWeight: 700
              }}
            >
              {result.headline}
            </div>
          )}
          {result.about && (
            <p
              style={{
                marginTop: 12,
                fontSize: 15,
                lineHeight: 1.6,
                color: "var(--text)"
              }}
            >
              {result.about}
            </p>
          )}
          {result.highlights.length > 0 && (
            <ul
              style={{
                marginTop: 14,
                paddingLeft: 18,
                lineHeight: 1.7,
                color: "var(--text-dim)"
              }}
            >
              {result.highlights.map((h, i) => (
                <li key={i} style={{ fontSize: 14 }}>
                  {h}
                </li>
              ))}
            </ul>
          )}
        </div>
        <Link
          href="/login?next=/onboarding"
          className="retro-btn retro-btn-primary"
          style={{
            marginTop: 16,
            width: "100%",
            textAlign: "center",
            textDecoration: "none",
            padding: "14px 16px",
            fontSize: 16,
            fontWeight: 800,
            display: "block"
          }}
        >
          Claim this as my live profile →
        </Link>
        <p
          style={{
            marginTop: 8,
            fontSize: 12,
            color: "var(--text-dim)",
            textAlign: "center"
          }}
        >
          Free. Publishes at syncedin.org/u/you, then your twin starts
          finding win-wins while you sleep.
        </p>
        <button
          type="button"
          onClick={shareTest}
          className="retro-btn"
          style={{ marginTop: 10, width: "100%", padding: "10px 14px" }}
        >
          {shared ? "✓ link ready to paste" : "Dare a friend to take the test"}
        </button>
        <button
          type="button"
          onClick={() => setResult(null)}
          style={{
            marginTop: 8,
            width: "100%",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "var(--text-dim)",
            fontSize: 12
          }}
        >
          ← edit what I pasted
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <div className="retro-panel retro-shadow" style={{ padding: 20 }}>
        <div className="retro-label">step 1 · copy the test prompt</div>
        <p
          className="retro-dim"
          style={{ marginTop: 6, fontSize: 13, lineHeight: 1.5 }}
        >
          One prompt that pulls out everything your AI remembers about you:
          goals, projects, how you think, what you&apos;d say yes to.
        </p>
        <button
          type="button"
          onClick={copyPrompt}
          className="retro-btn retro-btn-primary w-full"
          style={{ marginTop: 12, padding: "12px 14px", fontWeight: 800 }}
        >
          {copied ? "✓ Copied. Now ask your AI" : "Copy the prompt"}
        </button>

        <div className="retro-label" style={{ marginTop: 18 }}>
          step 2 · ask the AI you already use
        </div>
        <div
          style={{
            marginTop: 8,
            display: "grid",
            gap: 8,
            gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))"
          }}
        >
          {APPS.map((a) => (
            <a
              key={a.key}
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              className="retro-btn text-xs"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                justifyContent: "center"
              }}
            >
              <BrandLogo brand={a.key} size={16} />
              <span style={{ fontWeight: 700 }}>{a.label}</span>
            </a>
          ))}
        </div>
      </div>

      <div className="retro-label" style={{ marginTop: 18 }}>
        step 3 · paste its answer
      </div>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Your name"
        className="retro-input"
        style={{ marginTop: 8 }}
      />
      <textarea
        value={dump}
        onChange={(e) => setDump(e.target.value)}
        rows={7}
        placeholder="Paste your AI's full answer here. Long is good, the more it remembers, the sharper your decode."
        className="retro-input"
        style={{ marginTop: 8, fontSize: 14, lineHeight: 1.5 }}
      />
      <button
        type="button"
        onClick={decode}
        disabled={busy}
        className="retro-btn retro-btn-primary"
        style={{
          marginTop: 12,
          width: "100%",
          padding: "14px 16px",
          fontSize: 16,
          fontWeight: 800
        }}
      >
        {busy ? "Decoding what your AI knows…" : "✨ Decode my Personal Intelligence →"}
      </button>
      {err && (
        <div style={{ marginTop: 8, fontSize: 13, color: "var(--red, #ef4444)" }}>
          {err}
        </div>
      )}
      <p
        style={{
          marginTop: 8,
          fontSize: 12,
          color: "var(--text-dim)",
          textAlign: "center"
        }}
      >
        Free, no account needed to see your decode. Takes ~10 seconds.
      </p>
    </div>
  );
}
