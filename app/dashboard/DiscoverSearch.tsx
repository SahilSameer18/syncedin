"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { startConversationWithUser } from "./actions";

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
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    } catch {
      setDraftText("");
    } finally {
      setDrafting(null);
    }
  }

  const copy = (text: string) => navigator.clipboard?.writeText(text);
  const searching = q.trim().length > 0;

  return (
    <section>
      <div className="flex items-baseline justify-between">
        <div className="retro-label">discover</div>
        <div className="retro-dim text-xs">
          {searching ? "searching SyncedIn + web…" : `${directory.length} ready to sync`}
        </div>
      </div>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by name — find them on SyncedIn or anywhere on the web"
        className="retro-input mt-3"
      />

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

      {/* Search results */}
      {searching && (
        <div className="mt-4 space-y-5">
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
                  {results.exa_people.map((p) => (
                    <li
                      key={p.url}
                      className="retro-panel retro-panel-hover p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div className="font-semibold text-sm">{p.title}</div>
                          <a
                            href={p.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="retro-dim text-xs underline mt-1 inline-block"
                            style={{ wordBreak: "break-all" }}
                          >
                            {p.url}
                          </a>
                          {p.highlights.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {p.highlights.map((h, i) => (
                                <p key={i} className="text-sm">
                                  {h}
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => draftOutreach(p)}
                          disabled={drafting === p.url}
                          className="retro-btn text-sm shrink-0"
                        >
                          {drafting === p.url ? "Drafting…" : "Draft invite"}
                        </button>
                      </div>

                      {draftFor?.url === p.url && draftText && (
                        <div className="mt-3">
                          <textarea
                            value={draftText}
                            onChange={(e) => setDraftText(e.target.value)}
                            rows={5}
                            className="retro-input"
                          />
                          <div className="flex gap-2 mt-2">
                            <button
                              type="button"
                              onClick={() => copy(draftText)}
                              className="retro-btn retro-btn-primary text-sm"
                            >
                              Copy
                            </button>
                            <a
                              href={p.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="retro-btn text-sm"
                            >
                              Open profile →
                            </a>
                          </div>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
