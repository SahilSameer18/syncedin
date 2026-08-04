"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Avatar } from "../Avatar";

type Persona = {
  id: string;
  name: string;
  avatarUrl?: string | null;
  isPersona: boolean;
  hasEmbedding: boolean;
  goalsPreview: string;
};

type CompareResult = {
  personA: { id: string; name: string; goals: string; deal_preferences: string };
  personB: { id: string; name: string; goals: string; deal_preferences: string };
  oldScore: { score: number; sharedKeywordsCount: number; sharedKeywords: string[] };
  newScore: { score: number; rawCosineSim: number };
  matchAnalysis?: {
    verdict: string;
    matchReasons: string[];
    mismatchRisks: string[];
  };
  explanation: string;
};

// Animated Number Counter Hook
function useAnimatedCount(target: number, duration: number = 600) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let start = 0;
    const stepTime = 20;
    const steps = duration / stepTime;
    const increment = target / steps;

    const timer = setInterval(() => {
      start += increment;
      if (start >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, stepTime);

    return () => clearInterval(timer);
  }, [target, duration]);

  return count;
}

function PersonCard({
  slotLabel,
  accentColor,
  accentGlow,
  personas,
  excludeId,
  selected,
  onSelect
}: {
  slotLabel: string;
  accentColor: string;
  accentGlow: string;
  personas: Persona[];
  excludeId: string;
  selected: Persona | null;
  onSelect: (p: Persona) => void;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (modalOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [modalOpen]);

  const filtered = personas
    .filter((p) => p.id !== excludeId)
    .filter((p) => p.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <>
      <div
        className="relative group rounded-2xl p-5 transition-all duration-300 border bg-[var(--panel-solid)] hover:shadow-xl flex flex-col justify-between min-h-[220px]"
        style={{
          borderColor: selected ? accentColor : "var(--border)",
          boxShadow: selected ? `0 4px 24px -6px ${accentGlow}` : undefined
        }}
      >
        {/* Top bar with label and change button */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full"
              style={{
                background: accentColor,
                boxShadow: `0 0 0 4px ${accentGlow}`
              }}
            />
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[var(--text-dim)]">
              {slotLabel}
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              setQuery("");
              setModalOpen(true);
            }}
            className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[var(--panel-2)] hover:bg-[var(--border)] border border-[var(--border)] text-[var(--text)] transition-colors cursor-pointer flex items-center gap-1"
          >
            <span>{selected ? "Switch" : "Select"}</span>
            <span className="text-[10px] opacity-60">▼</span>
          </button>
        </div>

        {/* Selected Profile View */}
        {selected ? (
          <div className="flex-1 flex flex-col justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <Avatar
                  id={selected.id}
                  name={selected.name}
                  avatarUrl={selected.avatarUrl}
                  size={52}
                />
                <span
                  className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-[var(--panel-solid)] bg-emerald-400"
                  title="Active Profile"
                />
              </div>

              <div className="min-w-0 flex-1">
                <h3 className="text-base font-bold text-[var(--text)] truncate">
                  {selected.name}
                </h3>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[var(--panel-2)] border border-[var(--border)] text-[var(--text-dim)]">
                    {selected.isPersona ? "Persona" : "Member"}
                  </span>
                  <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                    <span>●</span> Ready
                  </span>
                </div>
              </div>
            </div>

            {/* Goals Quote Box */}
            <div className="mt-4 p-3 rounded-xl bg-[var(--panel-2)] border border-[var(--border)] text-xs text-[var(--text-dim)] leading-relaxed">
              <span className="text-[10px] font-mono font-bold uppercase text-[var(--text)] block mb-0.5 opacity-80">
                Current Focus:
              </span>
              <p className="line-clamp-2 italic">
                "{selected.goalsPreview || "No specific focus defined"}"
              </p>
            </div>
          </div>
        ) : (
          /* Empty Card State */
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setModalOpen(true);
            }}
            className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-[var(--border)] hover:border-[var(--amber-bright)] rounded-xl p-6 transition-all text-center cursor-pointer group/btn"
          >
            <div className="w-12 h-12 rounded-full bg-[var(--panel-2)] flex items-center justify-center text-lg text-[var(--text-dim)] group-hover/btn:text-[var(--text)] group-hover/btn:scale-110 transition-transform mb-2">
              +
            </div>
            <span className="text-xs font-bold text-[var(--text)]">Choose a profile</span>
            <span className="text-[11px] text-[var(--text-dim)] mt-0.5">
              Click to browse {personas.length} available members
            </span>
          </button>
        )}
      </div>

      {/* Profile Selector Popover / Dialog */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div
            className="w-full max-w-md rounded-2xl bg-[var(--panel-solid)] border border-[var(--border-bright)] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-[var(--text)]">
                  Select for {slotLabel}
                </h4>
                <p className="text-xs text-[var(--text-dim)]">
                  Pick a member twin to test compatibility
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="w-7 h-7 rounded-full bg-[var(--panel-2)] hover:bg-[var(--border)] text-[var(--text-dim)] hover:text-[var(--text)] flex items-center justify-center text-xs font-bold cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Search Input */}
            <div className="p-3 border-b border-[var(--border)] bg-[var(--panel-2)]">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[var(--text-dim)]">
                  🔍
                </span>
                <input
                  ref={inputRef}
                  type="text"
                  className="retro-input w-full pl-8 pr-3 py-2 text-xs"
                  placeholder="Search by name or keyword..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            </div>

            {/* Profiles List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {filtered.length === 0 ? (
                <div className="p-8 text-center text-xs text-[var(--text-dim)]">
                  No matching profiles found for "{query}"
                </div>
              ) : (
                filtered.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      onSelect(p);
                      setModalOpen(false);
                    }}
                    className="w-full text-left p-3 rounded-xl hover:bg-[var(--panel-2)] border border-transparent hover:border-[var(--border)] transition-all flex items-center gap-3.5 cursor-pointer group"
                  >
                    <Avatar
                      id={p.id}
                      name={p.name}
                      avatarUrl={p.avatarUrl}
                      size={40}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[var(--text)] group-hover:text-[var(--amber-bright)] transition-colors truncate">
                          {p.name}
                        </span>
                        <span className="text-[10px] font-mono text-[var(--text-dim)]">
                          {p.isPersona ? "Persona" : "Member"}
                        </span>
                      </div>
                      <p className="text-[11px] text-[var(--text-dim)] truncate mt-0.5">
                        {p.goalsPreview || "No bio"}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function MatchLabPage() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loadingPersonas, setLoadingPersonas] = useState(true);
  const [personA, setPersonA] = useState<Persona | null>(null);
  const [personB, setPersonB] = useState<Persona | null>(null);
  const [comparing, setComparing] = useState(false);
  const [result, setResult] = useState<CompareResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedIntro, setCopiedIntro] = useState(false);

  useEffect(() => {
    fetch("/api/match-lab/personas")
      .then((r) => r.json())
      .then((json) => {
        const list: Persona[] = json.personas ?? [];
        setPersonas(list);
        if (list.length >= 2) {
          setPersonA(list[0]);
          setPersonB(list[1]);
        }
      })
      .catch((err) => console.error("Failed to load personas", err))
      .finally(() => setLoadingPersonas(false));
  }, []);

  async function handleCompare() {
    if (!personA || !personB) return;
    setComparing(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/match-lab/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIdA: personA.id, userIdB: personB.id })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to simulate match");
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setComparing(false);
    }
  }

  function handleShuffle() {
    if (personas.length < 2) return;
    const shuffled = [...personas].sort(() => 0.5 - Math.random());
    setPersonA(shuffled[0]);
    setPersonB(shuffled[1]);
    setResult(null);
  }

  function handleSwap() {
    if (!personA || !personB) return;
    const temp = personA;
    setPersonA(personB);
    setPersonB(temp);
    setResult(null);
  }

  const score = result ? result.newScore.score : 0;
  const animatedScore = useAnimatedCount(score);

  const getFitTier = (val: number) => {
    if (val >= 85) return { label: "High Mutual Leverage", color: "#10b981", bg: "rgba(16, 185, 129, 0.12)" };
    if (val >= 70) return { label: "Strong Complementary Synergy", color: "var(--amber-bright)", bg: "rgba(129, 140, 248, 0.12)" };
    if (val >= 50) return { label: "Moderate Strategic Fit", color: "var(--text)", bg: "var(--panel-2)" };
    return { label: "Low Immediate Alignment", color: "var(--text-dim)", bg: "var(--panel-2)" };
  };

  const fitTier = getFitTier(score);

  const handleCopyIntro = () => {
    if (!result) return;
    const cleanGoals = result.personA.goals
      ? result.personA.goals.split(".")[0].replace(/^["']|["']$/g, "").trim()
      : "";
    const topic = cleanGoals ? `around ${cleanGoals}` : "our shared focus areas";
    const introText = `Hi ${result.personB.name}, our twins matched with ${score}% synergy on SyncdIn (${topic}). Would love to connect and explore collaborating!`;
    navigator.clipboard.writeText(introText);
    setCopiedIntro(true);
    setTimeout(() => setCopiedIntro(false), 2000);
  };

  return (
    <main className="max-w-3xl mx-auto px-5 py-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[var(--border)]">
        <div>
          <Link
            href="/dashboard"
            className="text-xs font-mono text-[var(--amber-bright)] hover:underline flex items-center gap-1"
          >
            ← Command Center
          </Link>
          <h1 className="retro-h1 mt-2 text-2xl sm:text-3xl font-extrabold text-[var(--text)]">
            Match Simulator
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-[var(--text-dim)]">
            Simulate mutual synergy, compatibility score, and collaboration angles between any two profiles.
          </p>
        </div>

        <button
          onClick={handleShuffle}
          disabled={loadingPersonas || personas.length < 2}
          className="retro-btn text-xs py-2 px-3 self-start sm:self-auto flex items-center gap-1.5"
          title="Random pair"
        >
          <span>🎲</span>
          <span>Shuffle Pair</span>
        </button>
      </div>

      {/* Selector Arena */}
      {loadingPersonas ? (
        <div className="retro-panel p-12 text-center mt-6">
          <div className="inline-block w-6 h-6 rounded-full border-2 border-[var(--amber)] border-t-transparent animate-spin mb-2" />
          <p className="text-xs font-mono text-[var(--text-dim)]">Loading profiles...</p>
        </div>
      ) : (
        <div className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-11 gap-4 items-center">
            {/* Person A Card */}
            <div className="md:col-span-5">
              <PersonCard
                slotLabel="Profile 1"
                accentColor="var(--amber-bright)"
                accentGlow="rgba(129, 140, 248, 0.25)"
                personas={personas}
                excludeId={personB?.id ?? ""}
                selected={personA}
                onSelect={setPersonA}
              />
            </div>

            {/* Swap & Connector */}
            <div className="md:col-span-1 flex flex-col items-center justify-center py-2">
              <button
                type="button"
                onClick={handleSwap}
                className="w-10 h-10 rounded-full bg-[var(--panel-2)] hover:bg-[var(--panel-solid)] border border-[var(--border)] hover:border-[var(--amber-bright)] text-sm flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--text)] transition-all cursor-pointer shadow-md hover:scale-105"
                title="Swap candidates"
              >
                ⇄
              </button>
              <span className="text-[10px] font-mono uppercase text-[var(--text-dim)] mt-1 hidden md:block">
                vs
              </span>
            </div>

            {/* Person B Card */}
            <div className="md:col-span-5">
              <PersonCard
                slotLabel="Profile 2"
                accentColor="#10b981"
                accentGlow="rgba(16, 185, 129, 0.25)"
                personas={personas}
                excludeId={personA?.id ?? ""}
                selected={personB}
                onSelect={setPersonB}
              />
            </div>
          </div>

          {/* Action Trigger */}
          <div className="mt-6 flex flex-col items-center justify-center gap-2">
            <button
              onClick={handleCompare}
              disabled={comparing || !personA || !personB}
              className="retro-btn retro-btn-primary py-3.5 px-8 text-sm font-bold flex items-center gap-2 shadow-lg hover:shadow-indigo-500/20 hover:scale-[1.01] active:scale-[0.99] transition-all"
            >
              {comparing ? (
                <>
                  <span className="w-4 h-4 rounded-full border-2 border-black border-t-transparent animate-spin" />
                  <span>Simulating synergy & twin dialogue chance...</span>
                </>
              ) : (
                <span>⚡ Simulate Match Synergy</span>
              )}
            </button>

            {error && (
              <p className="text-xs text-rose-400 font-mono mt-2 bg-rose-500/10 px-3 py-1 rounded border border-rose-500/20">
                {error}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Match Result Display */}
      {result && (
        <div className="mt-8 space-y-5 animate-in fade-in duration-300">
          {/* Main Synergy Card */}
          <div className="retro-panel p-6 bg-[var(--panel-solid)] border border-[var(--border-bright)] relative overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-[var(--border)]">
              <div className="flex items-center gap-4">
                <div
                  className="w-16 h-16 rounded-full flex flex-col items-center justify-center font-black font-mono border-2 shadow-inner"
                  style={{
                    borderColor: fitTier.color,
                    background: "var(--panel-2)",
                    color: fitTier.color
                  }}
                >
                  <span className="text-2xl leading-none">{animatedScore}</span>
                  <span className="text-[9px] uppercase tracking-wider opacity-80">% FIT</span>
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className="text-[10px] font-mono px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold border"
                      style={{
                        borderColor: fitTier.color,
                        color: fitTier.color,
                        background: fitTier.bg
                      }}
                    >
                      {fitTier.label}
                    </span>
                    {result.matchAnalysis?.verdict && (
                      <span className="text-[10px] font-mono text-[var(--text-dim)]">
                        · {result.matchAnalysis.verdict}
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-[var(--text)] mt-1">
                    {result.personA.name} &amp; {result.personB.name}
                  </h3>
                </div>
              </div>

              <button
                onClick={handleCopyIntro}
                className="retro-btn text-xs py-1.5 px-3 flex items-center gap-1.5"
              >
                <span>{copiedIntro ? "✅" : "💬"}</span>
                <span>{copiedIntro ? "Intro Copied" : "Copy Intro Pitch"}</span>
              </button>
            </div>

            {/* AI Strategic Synergy */}
            <div className="mt-5">
              <div className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--amber-bright)] mb-1.5">
                Strategic Synergy Breakdown
              </div>
              <p className="text-sm sm:text-base text-[var(--text)] leading-relaxed font-medium">
                {result.explanation}
              </p>
            </div>

            {/* 1. Matches vs Mismatches Breakdown */}
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-5 border-t border-[var(--border)]">
              {/* Where they match */}
              <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 mb-2">
                  <span>🟢</span>
                  <span>Where They Match</span>
                </div>
                <ul className="space-y-1.5">
                  {(result.matchAnalysis?.matchReasons || ["Shared focus in technology & product growth"]).map((reason, idx) => (
                    <li key={idx} className="text-xs text-[var(--text)] flex items-start gap-2 leading-relaxed">
                      <span className="text-emerald-400 font-bold mt-0.5">•</span>
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Where they don't match / risks */}
              <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-400 mb-2">
                  <span>🔍</span>
                  <span>Divergence / Considerations</span>
                </div>
                <ul className="space-y-1.5">
                  {(result.matchAnalysis?.mismatchRisks || ["Differing immediate timelines or scope"]).map((risk, idx) => (
                    <li key={idx} className="text-xs text-[var(--text)] flex items-start gap-2 leading-relaxed">
                      <span className="text-amber-400 font-bold mt-0.5">•</span>
                      <span>{risk}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>


            {/* Profiles Side-by-Side Comparison */}
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-5 border-t border-[var(--border)]">
              {/* Person A Goals */}
              <div className="p-3.5 rounded-xl bg-[var(--panel-2)] border border-[var(--border)]">
                <span className="text-xs font-bold text-[var(--text)] block mb-1">
                  {result.personA.name}'s Focus
                </span>
                <p className="text-xs text-[var(--text-dim)] leading-relaxed">
                  {result.personA.goals || "No stated goals"}
                </p>
                {result.personA.deal_preferences && (
                  <div className="mt-2 pt-2 border-t border-[var(--border)] text-[11px] text-[var(--text-dim)]">
                    <strong className="text-[var(--text)] font-normal">Open to: </strong>
                    {result.personA.deal_preferences}
                  </div>
                )}
              </div>

              {/* Person B Goals */}
              <div className="p-3.5 rounded-xl bg-[var(--panel-2)] border border-[var(--border)]">
                <span className="text-xs font-bold text-[var(--text)] block mb-1">
                  {result.personB.name}'s Focus
                </span>
                <p className="text-xs text-[var(--text-dim)] leading-relaxed">
                  {result.personB.goals || "No stated goals"}
                </p>
                {result.personB.deal_preferences && (
                  <div className="mt-2 pt-2 border-t border-[var(--border)] text-[11px] text-[var(--text-dim)]">
                    <strong className="text-[var(--text)] font-normal">Open to: </strong>
                    {result.personB.deal_preferences}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
