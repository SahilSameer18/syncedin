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
  personas,
  excludeId,
  selected,
  onSelect
}: {
  slotLabel: string;
  accentColor: string;
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
        className="relative group rounded-3xl p-5 transition-all duration-300 border bg-white glass-card-elevated flex flex-col justify-between min-h-[230px]"
        style={{
          borderColor: selected ? accentColor : "rgba(124, 58, 237, 0.15)"
        }}
      >
        {/* Top bar with label and change button */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ background: accentColor }}
            />
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
              {slotLabel}
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              setQuery("");
              setModalOpen(true);
            }}
            className="text-xs font-bold px-3 py-1 rounded-full bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-900 transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <span>{selected ? "Switch" : "Select"}</span>
            <span className="text-[10px] opacity-60">▼</span>
          </button>
        </div>

        {/* Selected Profile View */}
        {selected ? (
          <div className="flex-1 flex flex-col justify-between">
            <div className="flex items-center gap-3.5">
              <div className="relative">
                <Avatar
                  id={selected.id}
                  name={selected.name}
                  avatarUrl={selected.avatarUrl}
                  size={52}
                />
                <span
                  className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white bg-emerald-500"
                  title="Ready Profile"
                />
              </div>

              <div className="min-w-0 flex-1">
                <h3 className="text-base font-black text-slate-900 truncate">
                  {selected.name}
                </h3>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100/60 border border-purple-200 text-purple-800">
                    {selected.isPersona ? "Test Persona" : "Platform Member"}
                  </span>
                  <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                    ● Ready
                  </span>
                </div>
              </div>
            </div>

            {/* Goals Quote Box */}
            <div className="mt-3 p-3 rounded-2xl bg-purple-50/40 border border-purple-100/80 text-xs text-slate-600 leading-relaxed">
              <span className="text-[10px] font-black uppercase text-slate-500 block mb-0.5">
                Current Focus:
              </span>
              <p className="line-clamp-2 italic font-medium">
                &ldquo;{selected.goalsPreview || "No specific focus defined"}&rdquo;
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
            className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-purple-200 hover:border-purple-600 rounded-2xl p-6 transition-all text-center cursor-pointer group/btn"
          >
            <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center text-lg text-purple-600 group-hover/btn:scale-110 transition-transform mb-2">
              +
            </div>
            <span className="text-xs font-black text-slate-900">Choose a profile</span>
            <span className="text-[11px] text-slate-500 font-medium mt-0.5">
              Click to browse {personas.length} available members
            </span>
          </button>
        )}
      </div>

      {/* Profile Selector Popover / Dialog */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div
            className="w-full max-w-md rounded-3xl bg-white border border-purple-100 shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 border-b border-purple-100 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-black text-slate-900">
                  Select Profile for {slotLabel}
                </h4>
                <p className="text-xs text-slate-500 font-medium">
                  Pick a member twin to test mutual synergy
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 flex items-center justify-center text-xs font-black"
              >
                ✕
              </button>
            </div>

            {/* Search Input */}
            <div className="p-3 border-b border-purple-100 bg-purple-50/40">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name..."
                className="w-full p-2.5 px-3.5 rounded-2xl bg-white border border-purple-200 text-slate-900 text-xs font-medium placeholder-slate-400 focus:outline-none focus:border-purple-600 transition-all shadow-inner"
              />
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1 divide-y divide-purple-50">
              {filtered.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 font-medium">
                  No matching profiles found
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
                    className="w-full p-2.5 rounded-2xl hover:bg-purple-50/70 transition-colors flex items-center gap-3 text-left group"
                  >
                    <Avatar
                      id={p.id}
                      name={p.name}
                      avatarUrl={p.avatarUrl}
                      size={40}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-slate-900 group-hover:text-purple-700 transition-colors truncate">
                          {p.name}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400">
                          {p.isPersona ? "Test Persona" : "Member"}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5">
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
    if (val >= 70) return { label: "Strong Complementary Synergy", color: "#7c3aed", bg: "rgba(124, 58, 237, 0.12)" };
    if (val >= 50) return { label: "Moderate Strategic Fit", color: "#64748b", bg: "rgba(100, 116, 139, 0.12)" };
    return { label: "Low Immediate Alignment", color: "#94a3b8", bg: "rgba(148, 163, 184, 0.12)" };
  };

  const fitTier = getFitTier(score);

  const handleCopyIntro = () => {
    if (!result) return;
    const cleanGoals = result.personA.goals
      ? result.personA.goals.split(".")[0].replace(/^["']|["']$/g, "").trim()
      : "";
    const topic = cleanGoals ? `around ${cleanGoals}` : "our shared focus areas";
    const introText = `Hi ${result.personB.name}, our twins matched with ${score}% synergy on SyncedIn (${topic}). Would love to connect and explore collaborating!`;
    navigator.clipboard.writeText(introText);
    setCopiedIntro(true);
    setTimeout(() => setCopiedIntro(false), 2000);
  };

  return (
    <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-purple-100">
        <div>
          <Link
            href="/dashboard"
            className="text-xs font-bold text-purple-700 hover:text-purple-900 transition-colors flex items-center gap-1 mb-2"
          >
            ← Back to Command Center
          </Link>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[11px] font-black bg-purple-100 text-purple-800 border border-purple-200 uppercase tracking-wider">
              ⚡ Vector Match Lab
            </span>
          </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Match Simulator Sandbox
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
              Simulate mutual synergy, compatibility score, and collaboration angles between any two profiles.
            </p>
          </div>

          <button
            onClick={handleShuffle}
            disabled={loadingPersonas || personas.length < 2}
            className="px-4 py-2 rounded-full text-xs font-bold bg-purple-50 hover:bg-purple-600 text-purple-900 hover:text-white border border-purple-200/80 transition-all self-start sm:self-auto flex items-center gap-1.5 shadow-xs"
            title="Random pair"
          >
            <span>🎲</span>
            <span>Shuffle Pair</span>
          </button>
        </div>

        {/* Selector Arena */}
        {loadingPersonas ? (
          <div className="glass-card-elevated p-12 text-center mt-6">
            <div className="inline-block w-6 h-6 rounded-full border-2 border-purple-600 border-t-transparent animate-spin mb-2" />
            <p className="text-xs font-bold text-slate-500">Loading profiles...</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-11 gap-4 items-center">
              {/* Person A Card */}
              <div className="md:col-span-5">
                <PersonCard
                  slotLabel="Profile 1"
                  accentColor="#7c3aed"
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
                  className="w-10 h-10 rounded-full bg-white hover:bg-purple-50 border border-purple-200 hover:border-purple-600 text-sm flex items-center justify-center text-slate-500 hover:text-purple-900 transition-all cursor-pointer shadow-md hover:scale-105"
                  title="Swap candidates"
                >
                  ⇄
                </button>
                <span className="text-[10px] font-black uppercase text-purple-800 mt-1 hidden md:block">
                  vs
                </span>
              </div>

              {/* Person B Card */}
              <div className="md:col-span-5">
                <PersonCard
                  slotLabel="Profile 2"
                  accentColor="#10b981"
                  personas={personas}
                  excludeId={personA?.id ?? ""}
                  selected={personB}
                  onSelect={setPersonB}
                />
              </div>
            </div>

            {/* Action Trigger */}
            <div className="flex flex-col items-center justify-center gap-2">
              <button
                onClick={handleCompare}
                disabled={comparing || !personA || !personB}
                className="btn-purple-pill py-3.5 px-8 text-sm font-black flex items-center gap-2 shadow-lg shadow-purple-600/25 hover:scale-[1.01] active:scale-[0.99] transition-all"
              >
                {comparing ? (
                  <>
                    <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    <span>Simulating synergy &amp; twin dialogue chance...</span>
                  </>
                ) : (
                  <span>⚡ Simulate Match Synergy</span>
                )}
              </button>

              {error && (
                <p className="text-xs text-rose-600 font-bold mt-2 bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-200">
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
            <div className="glass-card-elevated p-6 bg-white border border-purple-200/90 relative overflow-hidden space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-purple-100">
                <div className="flex items-center gap-4">
                  <div
                    className="w-16 h-16 rounded-2xl flex flex-col items-center justify-center font-black border-2 shadow-inner"
                    style={{
                      borderColor: fitTier.color,
                      background: fitTier.bg,
                      color: fitTier.color
                    }}
                  >
                    <span className="text-2xl leading-none">{animatedScore}</span>
                    <span className="text-[9px] uppercase tracking-wider opacity-80">% FIT</span>
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className="text-[10px] px-2.5 py-0.5 rounded-full uppercase tracking-wider font-black border"
                        style={{
                          borderColor: fitTier.color,
                          color: fitTier.color,
                          background: fitTier.bg
                        }}
                      >
                        {fitTier.label}
                      </span>
                      {result.matchAnalysis?.verdict && (
                        <span className="text-xs font-bold text-slate-500">
                          · {result.matchAnalysis.verdict}
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-black text-slate-900 mt-1">
                      {result.personA.name} &amp; {result.personB.name}
                    </h3>
                  </div>
                </div>

                <button
                  onClick={handleCopyIntro}
                  className="btn-purple-pill text-xs py-2 px-4 flex items-center gap-1.5 shadow-sm"
                >
                  <span>{copiedIntro ? "✅" : "💬"}</span>
                  <span>{copiedIntro ? "Intro Pitch Copied!" : "Copy Intro Pitch"}</span>
                </button>
              </div>

              {/* AI Strategic Synergy */}
              <div className="space-y-1.5">
                <div className="text-xs font-black uppercase tracking-wider text-purple-900">
                  Strategic Synergy Breakdown
                </div>
                <p className="text-sm text-slate-700 leading-relaxed font-medium">
                  {result.explanation}
                </p>
              </div>

              {/* 1. Matches vs Mismatches Breakdown */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-purple-100">
                {/* Where they match */}
                <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/80">
                  <div className="flex items-center gap-2 text-xs font-black text-emerald-800 mb-2">
                    <span>🟢</span>
                    <span>Where They Match</span>
                  </div>
                  <ul className="space-y-1.5">
                    {(result.matchAnalysis?.matchReasons || ["Shared focus in technology & product growth"]).map((reason, idx) => (
                      <li key={idx} className="text-xs text-slate-700 font-medium flex items-start gap-2 leading-relaxed">
                        <span className="text-emerald-600 font-bold mt-0.5">•</span>
                        <span>{reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Where they don't match / risks */}
                <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80">
                  <div className="flex items-center gap-2 text-xs font-black text-amber-800 mb-2">
                    <span>🔍</span>
                    <span>Divergence / Considerations</span>
                  </div>
                  <ul className="space-y-1.5">
                    {(result.matchAnalysis?.mismatchRisks || ["Differing immediate timelines or scope"]).map((risk, idx) => (
                      <li key={idx} className="text-xs text-slate-700 font-medium flex items-start gap-2 leading-relaxed">
                        <span className="text-amber-600 font-bold mt-0.5">•</span>
                        <span>{risk}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Profiles Side-by-Side Comparison */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-purple-100">
                {/* Person A Goals */}
                <div className="p-4 rounded-2xl bg-purple-50/30 border border-purple-100">
                  <span className="text-xs font-black text-slate-900 block mb-1">
                    {result.personA.name}&apos;s Focus
                  </span>
                  <p className="text-xs text-slate-600 font-medium leading-relaxed">
                    {result.personA.goals || "No stated goals"}
                  </p>
                  {result.personA.deal_preferences && (
                    <div className="mt-2 pt-2 border-t border-purple-100 text-xs text-slate-600">
                      <strong className="text-slate-900 font-bold">Open to: </strong>
                      {result.personA.deal_preferences}
                    </div>
                  )}
                </div>

                {/* Person B Goals */}
                <div className="p-4 rounded-2xl bg-purple-50/30 border border-purple-100">
                  <span className="text-xs font-black text-slate-900 block mb-1">
                    {result.personB.name}&apos;s Focus
                  </span>
                  <p className="text-xs text-slate-600 font-medium leading-relaxed">
                    {result.personB.goals || "No stated goals"}
                  </p>
                  {result.personB.deal_preferences && (
                    <div className="mt-2 pt-2 border-t border-purple-100 text-xs text-slate-600">
                      <strong className="text-slate-900 font-bold">Open to: </strong>
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
