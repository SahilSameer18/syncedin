"use client";

import { useEffect, useState } from "react";
import { BrandLogo, type BrandKey } from "../BrandLogo";

/**
 * Multi-source AI export uploader. Per Jack: "I use Claude AND ChatGPT
 * every day for months — both have huge depth on me, integrating BOTH
 * (not just one) is a massive twin-quality unlock. This integration
 * is king."
 *
 * Each user gets one row per source so they can paste a deep self-
 * description from each AI tool. Each section has its own platform-
 * tuned prompt (what to ASK that tool that it'd uniquely know about
 * them).
 *
 * Persists to /api/ai-exports (one row per user+source, upsert).
 * Mounted on /onboarding so it shows up as part of the twin-build flow.
 */

type Source = {
  key: "chatgpt" | "claude" | "gemini" | "perplexity" | "grok";
  label: string;
  brand: BrandKey;
  prompt: string;
};

// King-level twin context. Each prompt is engineered to extract
// deal-actionable self-descriptions — NOT "personality bios."
// The shared backbone is the same across platforms (every section gets
// the full structured drill-down) with platform-specific phrasing so each
// AI is nudged to lean into the slice of you it knows best.
//
// Hard rules baked into every prompt:
//  - NO word-count limits, floor, or ceiling (Jack: "let it give us as
//    much as it feels it needs"). The prompt asks for max depth and
//    trusts the model to surface everything it has.
//  - Drops "personality/humor" sections entirely — Jack: "Asking what I
//    find funny doesn't matter."
//  - Heavy weighting on projects, intros, deals, collabs (the levers a
//    twin can actually pull in a real conversation)
//  - First-person, concrete, names companies/people/dollar amounts where
//    relevant
//  - No bestseller-style filler ("I'm a builder who...") — surgical detail
const SHARED_OUTLINE = `You are writing the dossier my digital twin will use to represent me in real conversations with strangers. Tone: surgical, first-person, zero filler. NEVER write generic "personality" descriptions — skip what I find funny, skip hobbies, skip MBTI. The twin needs ammunition, not vibes.

Length: write as much as you need. There is no minimum and no maximum — go deep on every section you actually have signal on, and skim only the sections where you genuinely have nothing. Use headers + bullets liberally. Be the most specific you have ever been.

Required sections (in order):

1. EVERYTHING I AM WORKING ON RIGHT NOW.
   List every project, company, venture, side-bet, fund, podcast, course, app, fork — name them by name. For each: (a) what stage it's at this week, (b) what's the current bottleneck, (c) what would move it forward, (d) who else is involved by name.

2. THE EXACT INTROS THAT WOULD MOVE THE NEEDLE.
   Not "investors" — name the SHAPE of investor (stage, check size, sector thesis), the SHAPE of operator (function, prior company DNA), or by literal name if I've mentioned wanting to meet them. For each intro target, write one sentence of WHY them specifically, and one sentence of WHAT I would say in the first message.

3. DEAL STRUCTURES I WILL DO AND WON'T DO.
   Term sheets, equity splits, advisor grants, revenue share, retainers — what I have agreed to before and at what numbers. What I have walked away from. What the floor / ceiling is on each. What signal makes me say yes fast vs. ghost.

4. COLLABORATIONS THAT WOULD ACTUALLY MOVE THINGS.
   Not "I love to collab!" — describe the specific 3-5 partnership shapes that compound my current work. For each: which of my projects it plugs into, what the other side gets, what the first 30 days look like.

5. CONCRETE RECENT WINS — WITH DETAILS.
   What I've actually shipped, raised, sold, hired, recruited in the last 6-12 months. Names. Numbers. Specifics another founder would recognize as credible. Avoid vagueness — replace "scaled a SaaS" with "took ARR from $40K to $1.2M MRR in 11 months with a 3-person team."

6. WHAT I HAVE THAT I CAN GIVE.
   The other side of the bait — what I can offer the network this quarter. Warm intros (be specific about who), unused budget, advisory hours, distribution, audience, code, designs, office space, anything.

7. THE THINGS YOU MUST NEVER LET MY TWIN DO.
   Hard nos. Behaviors / topics / categories of ask that should trigger instant decline. Past mistakes you've watched me make that I'd want auto-blocked.

8. THE THINGS I CARE ABOUT THIS QUARTER.
   The 3-5 outcomes that, if achieved, would mean the next 90 days were a win. Specific enough to measure.

DO NOT output any preamble. Start with the first heading. Use my own phrasing where you've heard it. End when you've covered all 8 sections in depth.`;

const SOURCES: Source[] = [
  {
    key: "chatgpt",
    label: "ChatGPT",
    brand: "chatgpt",
    prompt: `Based on EVERY conversation we have ever had — including code, brainstorms, drafts, decisions, doubts, rants — produce the full dossier below. ChatGPT, you've watched me iterate on the actual work. Lean into the operational detail you've seen me sweat.

${SHARED_OUTLINE}`
  },
  {
    key: "claude",
    label: "Claude",
    brand: "claude",
    prompt: `Across the whole arc of our conversations, write the full dossier below. Claude, you've been my long-form thinking partner — lean into strategy, second-order effects, and the specific deals / pitches / drafts we've talked through. Don't summarize — pull the receipts.

${SHARED_OUTLINE}`
  },
  {
    key: "gemini",
    label: "Gemini",
    brand: "gemini",
    prompt: `Based on our chat history and anything you know about me from Google services I've connected, produce the full dossier below. Gemini, lean into anything cross-referenced from my Drive, Calendar, or research sessions you can recall.

${SHARED_OUTLINE}`
  },
  {
    key: "perplexity",
    label: "Perplexity",
    brand: "perplexity",
    prompt: `From every conversation + every research thread I've run with you, write the full dossier below. Perplexity, you've been the research arm — surface the specific market context, named competitors, named people I've asked you to look up, and any data points you've pulled for me that the twin should know.

${SHARED_OUTLINE}`
  },
  {
    key: "grok",
    label: "Grok",
    brand: "grok",
    prompt: `Based on everything I've talked to you about — including anything you've pulled from my X timeline / replies / DMs / following graph — produce the full dossier below. Grok, lean into the social-graph + real-time signal layer the other AIs don't see: who I've been engaging with, what I've been posting about, what's trending in my circle.

${SHARED_OUTLINE}`
  }
];

export function AiExportsPanel() {
  const [openKey, setOpenKey] = useState<Source["key"] | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/ai-exports");
        const j = await res.json();
        if (cancelled) return;
        const next: Record<string, string> = {};
        for (const e of (j.exports ?? []) as any[]) {
          if (typeof e.source === "string" && typeof e.content === "string") {
            next[e.source] = e.content;
          }
        }
        setValues(next);
      } catch {
        /* offline / unauthed — start empty */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function copyPrompt(source: Source) {
    try {
      await navigator.clipboard.writeText(source.prompt);
      setCopied(source.key);
      window.setTimeout(() => setCopied(null), 1800);
    } catch {
      window.prompt("Copy this prompt:", source.prompt);
    }
  }

  async function save(key: Source["key"], content: string) {
    if (!content.trim()) return;
    try {
      const res = await fetch("/api/ai-exports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ source: key, content })
      });
      if (res.ok) {
        setSavedAt((s) => ({ ...s, [key]: Date.now() }));
      }
    } catch {
      /* non-fatal — user can retry */
    }
  }

  const totalConnected = Object.values(values).filter(
    (v) => v && v.trim().length > 0
  ).length;

  return (
    <div className="glass-card-elevated p-6 space-y-6 text-left">
      <div className="space-y-1">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-100 border border-purple-200 text-purple-800 text-xs font-bold uppercase">
          <span>✨ KING-LEVEL TWIN CONTEXT</span>
        </div>
        <h3 className="text-xl font-extrabold text-slate-900 tracking-tight pt-1">
          Connect your AI tools — each one knows you differently
        </h3>
        <p className="text-xs text-slate-500 font-medium leading-relaxed">
          You use ChatGPT, Claude, Gemini, Perplexity, or Grok daily. Pull that depth into your Twin so it can actually represent you.{" "}
          <strong className="text-purple-700 font-extrabold">
            {totalConnected} of {SOURCES.length} connected.
          </strong>
        </p>
      </div>

      <div className="space-y-3">
        {SOURCES.map((source) => {
          const isOpen = openKey === source.key;
          const value = values[source.key] || "";
          const hasData = value.trim().length > 0;
          return (
            <div key={source.key} className="space-y-2">
              <div
                onClick={() =>
                  setOpenKey((k) => (k === source.key ? null : source.key))
                }
                className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                  hasData
                    ? "bg-emerald-50/50 border-emerald-200 text-emerald-950"
                    : isOpen
                    ? "bg-purple-50/60 border-purple-300 shadow-sm"
                    : "bg-white border-purple-100 hover:border-purple-200"
                }`}
              >
                <div className="flex items-center gap-2.5 font-bold text-sm text-slate-900">
                  <BrandLogo brand={source.brand} size={20} />
                  <span>{source.label}</span>
                </div>
                <span className={`text-xs font-bold ${hasData ? "text-emerald-700" : "text-slate-400"}`}>
                  {hasData
                    ? `✓ ${value.length.toLocaleString()} chars`
                    : isOpen
                    ? "Close"
                    : "+ Add"}
                </span>
              </div>
              {isOpen && (
                <div className="p-4 rounded-2xl bg-purple-50/50 border border-purple-100 space-y-3">
                  <div className="text-xs font-bold text-purple-800 uppercase tracking-wider">
                    Step 1 — copy prompt into {source.label}
                  </div>
                  <pre className="p-3.5 rounded-xl bg-white border border-purple-100 text-[11px] text-slate-700 font-mono whitespace-pre-wrap max-h-36 overflow-y-auto leading-relaxed">
                    {source.prompt}
                  </pre>

                  <button
                    type="button"
                    onClick={() => copyPrompt(source)}
                    className="btn-purple-pill py-2 px-4 text-xs font-bold shadow-sm"
                  >
                    {copied === source.key ? "✓ Copied!" : "📋 Copy Prompt"}
                  </button>

                  <div className="text-xs font-bold text-purple-800 uppercase tracking-wider pt-2">
                    Step 2 — paste {source.label}&apos;s response here
                  </div>
                  <textarea
                    value={value}
                    onChange={(e) => {
                      const next = e.target.value.slice(0, 60_000);
                      setValues((s) => ({ ...s, [source.key]: next }));
                    }}
                    onBlur={() => save(source.key, value)}
                    rows={6}
                    placeholder={`Paste ${source.label}'s response here. Auto-saves on blur.`}
                    className="w-full p-3 rounded-2xl bg-white border border-purple-100 text-xs text-slate-900 focus:outline-none focus:border-purple-600 shadow-sm"
                  />
                  <div className="flex items-center justify-between text-[11px] font-medium text-slate-400">
                    <span>{value.length.toLocaleString()} / 60,000</span>
                    {savedAt[source.key] && (
                      <span className="text-emerald-700 font-bold">✓ Saved</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {loading && (
        <div
          aria-label="Loading saved exports"
          style={{ marginTop: 8, display: "grid", gap: 8 }}
        >
          {[0, 1].map((i) => (
            <div
              key={i}
              className="ob-skeleton"
              style={{ height: 44, borderRadius: 10 }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
