"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { startConversationWithUser } from "./actions";
import { DotsLoader } from "../DotsLoader";

type DirectoryUser = {
  id: string;
  display_name: string | null;
  email: string;
  goals: string | null;
};
type ExaPerson = { title: string; url: string; highlights: string[] };
type FindResponse = {
  sync_users: { id: string; display_name: string | null; email: string | null }[];
  exa_people: ExaPerson[];
};

const isEmail = (s: string) => /\S+@\S+\.\S+/.test(s);

/**
 * Top-of-dashboard Discover.
 * - Empty input → renders the existing-user directory (finished twins).
 * - Typed input → searches SyncedIn AND the open web (Exa) via
 *   /api/find-counterpart. Existing users get "Open" → start conversation.
 *   Web matches get "Draft invite" → your twin writes the outreach.
 */
export function DiscoverSearch({
  directory
}: {
  directory: DirectoryUser[];
}) {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<FindResponse>({
    sync_users: [],
    exa_people: []
  });
  const [drafting, setDrafting] = useState<string | null>(null);
  const [draftFor, setDraftFor] = useState<ExaPerson | null>(null);
  const [draftText, setDraftText] = useState("");
  const [shortText, setShortText] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  function toggleExpand(url: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  }

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    if (!q.trim()) {
      setResults({ sync_users: [], exa_people: [] });
      return;
    }
    setLoading(true);
    debounce.current = setTimeout(async () => {
      try {
        const r = await fetch("/api/find-counterpart", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ query: q.trim() })
        });
        const j = (await r.json()) as FindResponse;
        setResults({
          sync_users: j.sync_users ?? [],
          exa_people: j.exa_people ?? []
        });
      } catch {
        setResults({ sync_users: [], exa_people: [] });
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [q]);

  async function draftOutreach(p: ExaPerson) {
    setDraftFor(p);
    setDrafting(p.url);
    setDraftText("");
    setShortText("");
    setInviteUrl("");
    try {
      const r = await fetch("/api/exa-draft-outreach", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          person_title: p.title,
          person_url: p.url,
          highlights: p.highlights
        })
      });
      const j = await r.json();
      setDraftText(j.message ?? "");
      setShortText(j.short_message ?? "");
      setInviteUrl(j.invite_url ?? "");
    } catch {
      setDraftText("");
    } finally {
      setDrafting(null);
    }
  }

  const copy = (text: string) => navigator.clipboard?.writeText(text);
  const searching = q.trim().length > 0;

  // Twin-suggested connections.
  type Suggestion = {
    rationale: string;
    search_query: string;
    people: ExaPerson[];
  };
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [intent, setIntent] = useState("");
  const [lastIntent, setLastIntent] = useState("");

  // Cycling placeholder examples — rotate every ~3s so users see different
  // ways to use the freeform intent box.
  const SAMPLE_INTENTS = [
    "founders building in fintech right now",
    "investors who back AI music platforms",
    "biotech CEOs with humanitarian focus",
    "engineers shipping agentic infra",
    "operators in vertical SaaS",
    "writers covering the AI agent space",
    "lawyers who advise on token launches",
    "people building knowledge graphs",
    "product designers obsessed with retro UI"
  ];
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  useEffect(() => {
    if (intent.trim()) return; // freeze rotation if user is typing
    const t = setInterval(
      () => setPlaceholderIdx((i) => (i + 1) % SAMPLE_INTENTS.length),
      3000
    );
    return () => clearInterval(t);
  }, [intent]);

  async function askTwin(useIntent: string) {
    setSuggesting(true);
    setLastIntent(useIntent);
    try {
      const r = await fetch("/api/twin-suggest-connections", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(useIntent ? { intent: useIntent } : {})
      });
      const j = await r.json();
      setSuggestions(j.suggestions ?? []);
    } catch {
      setSuggestions([]);
    } finally {
      setSuggesting(false);
    }
  }

  return (
    <section>
      <div className="flex items-baseline justify-between">
        <div className="retro-label">discover</div>
        <div className="retro-dim text-xs">
          {searching ? "searching SyncedIn + web…" : `${directory.length} ready to sync`}
        </div>
      </div>

      <div className="mt-3 relative">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name. Find them on SyncedIn or anywhere on the web."
          className="retro-input"
          style={{ paddingRight: q ? 80 : 16 }}
        />
        {q && (
          <button
            type="button"
            onClick={() => setQ("")}
            className="retro-dim hover:text-white"
            style={{
              position: "absolute",
              right: 8,
              top: "50%",
              transform: "translateY(-50%)",
              fontSize: 12,
              padding: "4px 10px",
              borderRadius: 6,
              border: "1px solid var(--border-bright)",
              background: "var(--panel-2)"
            }}
          >
            × clear
          </button>
        )}
      </div>

      {/* Twin-recommended connections */}
      {!searching && (
        <div className="mt-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => askTwin(intent.trim())}
              disabled={suggesting}
              className="retro-btn retro-btn-primary shrink-0"
            >
              {suggesting ? (
                <DotsLoader label="searching" />
              ) : (
                "Find people"
              )}
            </button>
            <input
              value={intent}
              onChange={(e) => setIntent(e.target.value.slice(0, 280))}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  askTwin(intent.trim());
                }
              }}
              placeholder={
                intent
                  ? ""
                  : `e.g. "${SAMPLE_INTENTS[placeholderIdx]}"`
              }
              className="retro-input flex-1"
              maxLength={280}
            />
          </div>
          <div
            className="retro-dim text-xs mt-2"
            style={{ minHeight: 18 }}
          >
            {lastIntent
              ? `searched: "${lastIntent}"`
              : "Leave it blank to let your twin pick. Or type any intent — your twin combines it with your own context to find the right people."}
          </div>

          {suggestions && suggestions.length === 0 && !suggesting && (
            <p className="retro-dim text-sm mt-3">
              Your twin didn&apos;t surface any matches. Try adding more
              context to your twin in onboarding.
            </p>
          )}

          {suggestions && suggestions.length > 0 && (
            <div className="mt-4 space-y-5">
              {suggestions.map((s, idx) => (
                <div key={idx}>
                  <div
                    className="retro-label"
                    style={{ color: "var(--amber-bright)" }}
                  >
                    your twin says: {s.rationale}
                  </div>
                  <div className="retro-dim text-xs mt-1">
                    searched: {s.search_query}
                  </div>
                  {s.people.length === 0 ? (
                    <p className="retro-dim text-sm mt-2">
                      No matches for this one.
                    </p>
                  ) : (
                    <ul className="mt-2 space-y-2">
                      {s.people.slice(0, 4).map((p) => {
                        const isOpen = expanded.has(p.url);
                        const preview = p.highlights[0]
                          ? p.highlights[0].length > 140
                            ? p.highlights[0].slice(0, 140) + "…"
                            : p.highlights[0]
                          : "";
                        return (
                          <li
                            key={p.url}
                            className="retro-panel retro-panel-hover p-3"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="text-left flex-1 min-w-0">
                                <div className="font-semibold text-sm">
                                  {p.title}
                                </div>
                                <a
                                  href={p.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="retro-dim text-xs mt-0.5 underline hover:text-white block"
                                  style={{ wordBreak: "break-all" }}
                                >
                                  {p.url}
                                </a>
                                {!isOpen && preview && (
                                  <button
                                    type="button"
                                    onClick={() => toggleExpand(p.url)}
                                    className="retro-dim text-xs mt-1 line-clamp-2 text-left w-full"
                                    style={{
                                      background: "transparent",
                                      border: 0,
                                      padding: 0,
                                      cursor: "pointer"
                                    }}
                                  >
                                    {preview}
                                  </button>
                                )}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => toggleExpand(p.url)}
                                  className="retro-dim text-xs hover:text-white"
                                >
                                  {isOpen ? "− collapse" : "+ expand"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => draftOutreach(p)}
                                  disabled={drafting === p.url}
                                  className="retro-btn text-sm"
                                >
                                  {drafting === p.url ? (
                                    <DotsLoader label="Drafting" />
                                  ) : (
                                    "Draft invite"
                                  )}
                                </button>
                              </div>
                            </div>
                            {isOpen && p.highlights.length > 0 && (
                              <div className="mt-3 space-y-2 text-sm">
                                {p.highlights.map((h, i) => (
                                  <p key={i}>{h}</p>
                                ))}
                              </div>
                            )}
                            {draftFor?.url === p.url && draftText && (
                              <div className="mt-3 space-y-3">
                                {shortText && (
                                  <div>
                                    <div
                                      className="retro-label"
                                      style={{
                                        color: "var(--amber-bright)"
                                      }}
                                    >
                                      connection note · {shortText.length}/200
                                    </div>
                                    <textarea
                                      value={shortText}
                                      onChange={(e) =>
                                        setShortText(
                                          e.target.value.slice(0, 200)
                                        )
                                      }
                                      rows={2}
                                      className="retro-input mt-1 text-sm"
                                      maxLength={200}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => copy(shortText)}
                                      className="retro-btn text-sm mt-2"
                                    >
                                      Copy connection note
                                    </button>
                                  </div>
                                )}
                                <div>
                                  <div
                                    className="retro-label"
                                    style={{ color: "var(--amber-bright)" }}
                                  >
                                    direct message (with invite link)
                                  </div>
                                  <textarea
                                    value={draftText}
                                    onChange={(e) =>
                                      setDraftText(e.target.value)
                                    }
                                    rows={6}
                                    className="retro-input mt-1 text-sm"
                                  />
                                  <div className="flex flex-wrap gap-2 mt-2">
                                    <button
                                      type="button"
                                      onClick={() => copy(draftText)}
                                      className="retro-btn retro-btn-primary text-sm"
                                    >
                                      Copy DM
                                    </button>
                                    {inviteUrl && (
                                      <a
                                        href={inviteUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="retro-btn text-sm"
                                      >
                                        Preview invite page →
                                      </a>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Empty state — show the existing directory of finished twins */}
      {!searching && (
        <div className="mt-4 space-y-2">
          {directory.length === 0 ? (
            <div className="retro-panel p-4 text-sm">
              <div className="font-semibold">You&apos;re caught up on discovery.</div>
              <div className="retro-dim mt-1">
                Search above for anyone — your twin will draft an invite if
                they aren&apos;t on SyncedIn yet.
              </div>
            </div>
          ) : (
            directory.map((p) => (
              <form
                action={startConversationWithUser}
                key={p.id}
                className="retro-panel retro-panel-hover p-4 flex items-start justify-between gap-4"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-sm">
                    {p.display_name || p.email}
                  </div>
                  {p.goals && (
                    <div className="retro-dim text-xs mt-1 line-clamp-2">
                      {p.goals}
                    </div>
                  )}
                </div>
                <input type="hidden" name="userId" value={p.id} />
                <button
                  type="submit"
                  className="retro-btn text-xs shrink-0 self-center"
                >
                  connect &gt;
                </button>
              </form>
            ))
          )}
        </div>
      )}

      {/* Search results — capped so the chats below stay reachable */}
      {searching && (
        <div
          className="mt-4 space-y-5"
          style={{
            maxHeight: "60vh",
            overflowY: "auto",
            paddingRight: 4
          }}
        >
          {/* Email shortcut */}
          {isEmail(q) && (
            <div className="retro-panel p-3">
              <Link
                href={`/conversations/new?error=`}
                className="retro-btn retro-btn-primary text-sm"
              >
                &gt; Open conversation with {q.trim().toLowerCase()}
              </Link>
            </div>
          )}

          {/* SyncedIn matches */}
          <div>
            <div className="retro-label">on syncedin</div>
            {loading && results.sync_users.length === 0 ? (
              <p className="retro-dim text-sm mt-2">Searching…</p>
            ) : results.sync_users.length === 0 ? (
              <p className="retro-dim text-sm mt-2">No SyncedIn users matched.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {results.sync_users.map((u) => (
                  <li
                    key={u.id}
                    className="retro-panel retro-panel-hover p-3 flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="font-semibold text-sm">
                        {u.display_name || "Unnamed twin"}
                      </div>
                      {u.email && (
                        <div className="retro-dim text-xs">{u.email}</div>
                      )}
                    </div>
                    <form action={startConversationWithUser}>
                      <input type="hidden" name="userId" value={u.id} />
                      <button className="retro-btn retro-btn-primary text-sm">
                        &gt; open
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Exa web results */}
          {!isEmail(q) && (
            <div>
              <div className="retro-label">found on the web</div>
              {loading && results.exa_people.length === 0 ? (
                <p className="retro-dim text-sm mt-2">Checking the web…</p>
              ) : results.exa_people.length === 0 ? (
                <p className="retro-dim text-sm mt-2">
                  No web matches. Try a fuller name or add their company.
                </p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {results.exa_people.map((p) => {
                    const isOpen = expanded.has(p.url);
                    const preview = p.highlights[0]
                      ? p.highlights[0].length > 140
                        ? p.highlights[0].slice(0, 140) + "…"
                        : p.highlights[0]
                      : "";
                    return (
                      <li
                        key={p.url}
                        className="retro-panel retro-panel-hover p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="text-left flex-1 min-w-0">
                            <button
                              type="button"
                              onClick={() => toggleExpand(p.url)}
                              className="text-left font-semibold text-sm"
                              style={{
                                background: "transparent",
                                border: 0,
                                padding: 0,
                                cursor: "pointer",
                                color: "var(--text)"
                              }}
                            >
                              {p.title}
                            </button>
                            <a
                              href={p.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="retro-dim text-xs mt-0.5 underline hover:text-white block"
                              style={{ wordBreak: "break-all" }}
                            >
                              {p.url}
                            </a>
                            {!isOpen && preview && (
                              <button
                                type="button"
                                onClick={() => toggleExpand(p.url)}
                                className="retro-dim text-xs mt-1 line-clamp-1 text-left w-full"
                                style={{
                                  background: "transparent",
                                  border: 0,
                                  padding: 0,
                                  cursor: "pointer"
                                }}
                              >
                                {preview}
                              </button>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => toggleExpand(p.url)}
                              className="retro-dim text-xs hover:text-white"
                            >
                              {isOpen ? "− collapse" : "+ expand"}
                            </button>
                            <button
                              type="button"
                              onClick={() => draftOutreach(p)}
                              disabled={drafting === p.url}
                              className="retro-btn text-sm"
                            >
                              {drafting === p.url ? (
                                <DotsLoader label="Drafting" />
                              ) : (
                                "Draft invite"
                              )}
                            </button>
                          </div>
                        </div>

                        {isOpen && p.highlights.length > 0 && (
                          <div className="mt-3 space-y-2 text-sm">
                            {p.highlights.map((h, i) => (
                              <p key={i}>{h}</p>
                            ))}
                          </div>
                        )}

                        {draftFor?.url === p.url && draftText && (
                          <div className="mt-3 space-y-3">
                            {/* Short connection-request note (max 200 chars) */}
                            {shortText && (
                              <div>
                                <div
                                  className="retro-label flex items-center justify-between"
                                  style={{ color: "var(--amber-bright)" }}
                                >
                                  <span>connection note · {shortText.length}/200</span>
                                </div>
                                <textarea
                                  value={shortText}
                                  onChange={(e) =>
                                    setShortText(e.target.value.slice(0, 200))
                                  }
                                  rows={2}
                                  className="retro-input mt-1 text-sm"
                                  maxLength={200}
                                />
                                <div className="flex flex-wrap gap-2 mt-2">
                                  <button
                                    type="button"
                                    onClick={() => copy(shortText)}
                                    className="retro-btn text-sm"
                                  >
                                    Copy note
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      copy(shortText);
                                      const profile = draftFor?.url || "";
                                      if (profile) window.open(profile, "_blank", "noopener");
                                    }}
                                    className="retro-btn retro-btn-primary text-sm"
                                  >
                                    Copy &amp; open LinkedIn →
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Long DM with personal invite link */}
                            <div>
                              <div
                                className="retro-label"
                                style={{ color: "var(--amber-bright)" }}
                              >
                                direct message (with invite link)
                              </div>
                              <textarea
                                value={draftText}
                                onChange={(e) => setDraftText(e.target.value)}
                                rows={6}
                                className="retro-input mt-1 text-sm"
                              />
                              <div className="flex flex-wrap gap-2 mt-2">
                                <button
                                  type="button"
                                  onClick={() => copy(draftText)}
                                  className="retro-btn retro-btn-primary text-sm"
                                >
                                  Copy DM
                                </button>
                                {inviteUrl && (
                                  <a
                                    href={inviteUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="retro-btn text-sm"
                                  >
                                    Preview invite page →
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
