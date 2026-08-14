"use client";

import { useState } from "react";

// The fastest onboarding path: the AI you already talk to knows you best.
// Copy this prompt → paste into that AI → paste its answer into the dump box.
const AI_PROMPT = `Give me everything you know about me — my personality, current goals, active projects, communication style, key relationships and the dynamics with each, ongoing deals or negotiations, professional background, what I'm good at and what I struggle with, my deal-breakers, how I make decisions, what I'm trying to accomplish in the next 6–12 months, and what kinds of opportunities I'd say yes to immediately.

Be specific and concrete. Don't summarize — include exact phrases I use, quotes from past conversations if you have them, and named examples. If you have memories or stored context about me, surface all of it. If you don't know something, say "unknown" rather than guessing.

Output as plain text, structured by these headings:
# Background
# Current goals (next 6–12 months)
# Active projects
# Communication style (with examples of how I write)
# Key relationships
# Ongoing deals / negotiations
# Decision style
# Deal-breakers and constraints
# Opportunities I'd say yes to immediately`;

// Logos via Google's favicon CDN — high-resolution, no manual hosting.
const FAVICON = (domain: string) =>
  `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

const APPS = [
  { name: "ChatGPT", url: "https://chatgpt.com", logo: FAVICON("chatgpt.com") },
  { name: "Claude", url: "https://claude.ai", logo: FAVICON("claude.ai") },
  {
    name: "Gemini",
    url: "https://gemini.google.com/app",
    logo: FAVICON("gemini.google.com")
  },
  { name: "Grok", url: "https://grok.com", logo: FAVICON("grok.com") }
];

export function AiDumpHero() {
  const [copied, setCopied] = useState(false);

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(AI_PROMPT);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <div className="p-6 rounded-2xl bg-purple-50/60 border border-purple-100 space-y-4 text-left">
      <div className="flex items-center gap-2">
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-800 border border-purple-200 uppercase tracking-wider">
          FASTEST PATH (~30 SECONDS)
        </span>
      </div>

      <p className="text-xs text-slate-600 leading-relaxed font-medium">
        Copy the master prompt, open your preferred AI assistant (ChatGPT, Claude, Gemini, or Grok), and paste the answer into the box below — that&apos;s a fully trained AI Twin in 1 click!
      </p>

      {/* Copy Prompt CTA */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <button
          type="button"
          onClick={copyPrompt}
          className="btn-purple-pill py-2.5 px-5 text-xs font-black shadow-md shadow-purple-600/20 flex items-center justify-center gap-2 shrink-0"
        >
          <span>{copied ? "✓ Copied to Clipboard!" : "📋 Copy AI Master Prompt"}</span>
        </button>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-bold text-slate-400">Open in:</span>
          {APPS.map((a) => (
            <a
              key={a.name}
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-purple-100 text-xs font-bold text-slate-700 hover:border-purple-300 transition-all shadow-sm"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={a.logo}
                alt={a.name}
                className="w-4 h-4 rounded-full"
                loading="lazy"
              />
              <span>{a.name}</span>
            </a>
          ))}
        </div>
      </div>

      {/* Embedded Prompt Drawer */}
      <details className="pt-2">
        <summary className="text-xs font-bold text-purple-700 hover:text-purple-900 cursor-pointer select-none">
          🔍 Preview Master AI Prompt text →
        </summary>
        <pre className="mt-3 p-4 rounded-xl bg-white border border-purple-100 text-[11px] text-slate-700 font-mono whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
          {AI_PROMPT}
        </pre>
      </details>
    </div>
  );
}
