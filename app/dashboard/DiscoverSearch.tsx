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
 * Heuristic for detecting placeholder / in-progress / clearly-not-a-bio
 * goals strings so we don't ship cringey card text like "Trying to get
 * through the sign up page" once a user has actually finished setup.
 *
 * Returns true if the string is OK to display.
 */
function looksLikeRealBio(s: string | null | undefined): boolean {
  if (!s) return false;
  const t = s.trim();
  if (t.length < 15) return false;
  // Common placeholder/draft markers — case-insensitive.
  if (
    /^(trying|testing|test\b|asdf|qwert|placeholder|tbd|wip|in progress|getting through|getting started|just signed up|signing up|setting up|setup|onboarding|loading|todo|coming soon|fill .* later|update .* later)/i.test(
      t
    )
  )
    return false;
  // Obvious self-references to the platform's own UI.
  if (/sign\s*up\s*page|sign\s*in\s*page|onboarding\s*page|magic\s*link/i.test(t))
    return false;
  // Pure punctuation / repetition / single-word filler.
  if (!/[A-Za-z]/.test(t)) return false;
  if (/^(.)\1+$/.test(t)) return false;
  return true;
}

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
  /**
   * Per-person draft state. The Discover panel previously held ONE
   * `draftFor` / `draftText` / `shortText` / `inviteUrl` state at a time,
   * which meant clicking "Draft invite" on a second person silently
   * cancelled the first person's drafts. The user wants to be able to
   * have multiple drafts in flight at once and tab between them — so we
   * key everything by person.url.
   */
  type DraftState = {
    draftText: string;
    shortText: string;
    inviteUrl: string;
    generating: boolean;
  };
  const [drafts, setDrafts] = useState<Map<string, DraftState>>(new Map());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  function getDraft(url: string): DraftState | undefined {
    return drafts.get(url);
  }
  function setDraft(url: string, patch: Partial<DraftState>) {
    setDrafts((prev) => {
      const next = new Map(prev);
      const current =
        prev.get(url) ?? {
          draftText: "",
          shortText: "",
          inviteUrl: "",
          generating: false
        };
      next.set(url, { ...current, ...patch });
      return next;
    });
  }

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
    // Seed the draft state for THIS person without disturbing any other
    // in-flight draft. The LinkedIn connection note no longer needs the
    // invite URL inline (LinkedIn flags notes containing URLs as spam +
    // the URL goes in the follow-up DM after connection accept anyway).
    setDraft(p.url, {
      draftText: "",
      shortText: "",
      inviteUrl: "",
      generating: true
    });
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
      const url = (j.invite_url ?? "") as string;
      let short = (j.short_message ?? "") as string;
      if (short.length > 300) {
        short = short.slice(0, 297).trimEnd() + "…";
      }
      setDraft(p.url, {
        draftText: j.message ?? "",
        shortText: short,
        inviteUrl: url,
        generating: false
      });
    } catch {
      setDraft(p.url, { generating: false });
    }
  }

  const copy = (text: string) => navigator.clipboard?.writeText(text);
  const searching = q.trim().length > 0;

  /**
   * Open the recipient's LinkedIn profile in a new tab with the
   * connection note copied to clipboard. LinkedIn deliberately doesn't
   * expose a public URL scheme that pre-fills the connect-with-note
   * modal (would be too easy to abuse), so the best we can do is:
   *   1. Copy the note to clipboard.
   *   2. Open the profile so the user clicks Connect → Add a note → Paste.
   * That's still a single keyboard shortcut for the actual send.
   */
  function openLinkedInWithNote(profileUrl: string, note: string) {
    if (!profileUrl) return;
    try {
      navigator.clipboard?.writeText(note);
    } catch {
      /* clipboard may be blocked — user can still paste their last copy */
    }
    window.open(profileUrl, "_blank", "noopener,noreferrer");
  }
  const isLinkedInUrl = (url: string) =>
    /linkedin\.com\/(?:in|pub)\//i.test(url || "");

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

  // Auto-fire Find People the first time the dashboard mounts so the
  // user lands on a populated set of suggestions — the primary CTA we
  // want them clicking. Skip if suggestions already loaded (HMR reload)
  // or the user is actively searching by name.
  const autoFired = useRef(false);
  useEffect(() => {
    if (autoFired.current) return;
    if (suggestions !== null) return;
    if (searching) return;
    autoFired.current = true;
    askTwin("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
                            onClick={() => toggleExpand(p.url)}
                            style={{ cursor: "pointer" }}
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
                                  onClick={(e) => e.stopPropagation()}
                                  className="retro-dim text-xs mt-0.5 underline hover:text-white block"
                                  style={{ wordBreak: "break-all" }}
                                >
                                  {p.url}
                                </a>
                                {!isOpen && preview && (
                                  <div
                                    className="retro-dim text-xs mt-1 line-clamp-2"
                                  >
                                    {preview}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleExpand(p.url);
                                  }}
                                  className="retro-dim text-xs hover:text-white"
                                >
                                  {isOpen ? "− collapse" : "+ expand"}
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    draftOutreach(p);
                                  }}
                                  disabled={!!getDraft(p.url)?.generating}
                                  className="retro-btn text-sm"
                                >
                                  {getDraft(p.url)?.generating ? (
                                    <DotsLoader label="Drafting" />
                                  ) : getDraft(p.url)?.draftText ? (
                                    "Redraft"
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
                            {(() => {
                              const d = getDraft(p.url);
                              if (!d || !d.draftText) return null;
                              return (
                                <div
                                  className="mt-3 space-y-3"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {d.shortText && (
                                    <div>
                                      <div
                                        className="retro-label"
                                        style={{
                                          color: "var(--amber-bright)"
                                        }}
                                      >
                                        connection note · {d.shortText.length}/300
                                      </div>
                                      <textarea
                                        value={d.shortText}
                                        onChange={(e) =>
                                          setDraft(p.url, {
                                            shortText: e.target.value.slice(
                                              0,
                                              300
                                            )
                                          })
                                        }
                                        rows={3}
                                        className="retro-input mt-1 text-sm"
                                        maxLength={300}
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                      <div className="flex flex-wrap gap-2 mt-2">
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            copy(d.shortText);
                                          }}
                                          className="retro-btn text-sm"
                                        >
                                          Copy connection note
                                        </button>
                                        {isLinkedInUrl(p.url) && (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              openLinkedInWithNote(
                                                p.url,
                                                d.shortText
                                              );
                                            }}
                                            className="retro-btn retro-btn-primary text-sm"
                                            title="Note copied. LinkedIn opens — click Connect → Add a note → Paste"
                                          >
                                            Open LinkedIn (note copied)
                                          </button>
                                        )}
                                      </div>
                                      {isLinkedInUrl(p.url) && (
                                        <p
                                          className="text-xs mt-1.5"
                                          style={{ color: "var(--text-dim)" }}
                                        >
                                          LinkedIn doesn&apos;t allow apps to
                                          pre-fill the connect modal. Click
                                          the button: note is copied, profile
                                          opens, hit Connect → Add a note →
                                          paste.
                                        </p>
                                      )}
                                    </div>
                                  )}
                                  <div>
                                    <div
                                      className="retro-label"
                                      style={{
                                        color: "var(--amber-bright)"
                                      }}
                                    >
                                      direct message (with invite link)
                                    </div>
                                    <textarea
                                      value={d.draftText}
                                      onChange={(e) =>
                                        setDraft(p.url, {
                                          draftText: e.target.value
                                        })
                                      }
                                      rows={6}
                                      className="retro-input mt-1 text-sm"
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                    <div className="flex flex-wrap gap-2 mt-2">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          copy(d.draftText);
                                        }}
                                        className="retro-btn text-sm"
                                      >
                                        Copy DM
                                      </button>
                                      {d.inviteUrl && (
                                        <>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              copy(d.inviteUrl);
                                            }}
                                            className="retro-btn retro-btn-primary text-sm"
                                            title={d.inviteUrl}
                                          >
                                            🔗 Copy invite URL
                                          </button>
                                          <a
                                            href={d.inviteUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={(e) =>
                                              e.stopPropagation()
                                            }
                                            className="retro-btn text-sm"
                                          >
                                            Preview →
                                          </a>
                                        </>
                                      )}
                                    </div>
                                    {d.inviteUrl && (
                                      <div
                                        className="text-xs mt-1.5"
                                        style={{
                                          color: "var(--text-dim)",
                                          wordBreak: "break-all"
                                        }}
                                      >
                                        {d.inviteUrl}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })()}
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
                  {looksLikeRealBio(p.goals) && (
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
                        onClick={() => toggleExpand(p.url)}
                        style={{ cursor: "pointer" }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="text-left flex-1 min-w-0">
                            <div
                              className="text-left font-semibold text-sm"
                              style={{ color: "var(--text)" }}
                            >
                              {p.title}
                            </div>
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
                              <div
                                className="retro-dim text-xs mt-1 line-clamp-1"
                              >
                                {preview}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleExpand(p.url);
                              }}
                              className="retro-dim text-xs hover:text-white"
                            >
                              {isOpen ? "− collapse" : "+ expand"}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                draftOutreach(p);
                              }}
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
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => copy(inviteUrl)}
                                      className="retro-btn retro-btn-primary text-sm"
                                      title={inviteUrl}
                                    >
                                      🔗 Copy invite URL
                                    </button>
                                    <a
                                      href={inviteUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="retro-btn text-sm"
                                    >
                                      Preview →
                                    </a>
                                  </>
                                )}
                              </div>
                              {inviteUrl && (
                                <div
                                  className="text-xs mt-1.5"
                                  style={{
                                    color: "var(--text-dim)",
                                    wordBreak: "break-all"
                                  }}
                                >
                                  {inviteUrl}
                                </div>
                              )}
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
