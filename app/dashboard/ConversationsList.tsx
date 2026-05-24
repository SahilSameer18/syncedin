"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Avatar } from "../Avatar";
import { ClientDate } from "../ClientDate";
import { ExcitementControl } from "./ExcitementControl";
import { SocialIconRow, type SocialUrls } from "../SocialIconRow";

/**
 * Dashboard conversations list — client component so we can filter
 * and re-sort without a server round-trip. Jack: "lets have it say
 * SYNC SCORE [filter ▼]" + the (i) tooltip moves up into the header
 * (was duplicated per-row before).
 *
 * Filters:
 *   - excitement  (legacy default — the "X excited about this convo")
 *   - sync        (sync score: high → low)
 *   - active      (most recently active — last message time)
 *   - newest      (most recent conversation creation)
 *
 * The SocialIconRow under each name lights up the LinkedIn / X / IG /
 * Facebook buttons we have on file for the counterpart, so the user
 * can verify them before opening the convo. Profile rows without any
 * social URLs simply render no icons (the component returns null).
 */
export type ConversationRow = {
  id: string;
  other_id: string;
  other_name: string;
  other_avatar: string | null;
  other_socials: SocialUrls | null;
  status: { kind: string; label: string; color: string } | null;
  counterpart_summary: string | null;
  summary: string | null;
  created_at: string;
  excitement_score: number | null;
  excitement_locked: boolean | null;
  sync_score: number;
  last_message_at: string | null;
};

type SortKey = "excitement" | "sync" | "active" | "newest";

const SORTS: Array<{ key: SortKey; label: string }> = [
  { key: "excitement", label: "Excitement" },
  { key: "sync", label: "Sync score" },
  { key: "active", label: "Most recent active" },
  { key: "newest", label: "Most recent convo" }
];

export function ConversationsList({ rows }: { rows: ConversationRow[] }) {
  const [sort, setSort] = useState<SortKey>("excitement");
  const [openFilter, setOpenFilter] = useState(false);

  const sorted = useMemo(() => {
    const list = [...rows];
    switch (sort) {
      case "sync":
        return list.sort((a, b) => b.sync_score - a.sync_score);
      case "active":
        return list.sort((a, b) => {
          const at = a.last_message_at || a.created_at;
          const bt = b.last_message_at || b.created_at;
          return new Date(bt).getTime() - new Date(at).getTime();
        });
      case "newest":
        return list.sort(
          (a, b) =>
            new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime()
        );
      case "excitement":
      default:
        return list.sort(
          (a, b) =>
            (b.excitement_score ?? -1) - (a.excitement_score ?? -1)
        );
    }
  }, [rows, sort]);

  const sortLabel = SORTS.find((s) => s.key === sort)?.label ?? "Excitement";

  return (
    <section>
      <div
        className="retro-label"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          flexWrap: "wrap"
        }}
      >
        <span>
          your conversations · sorted by{" "}
          <span style={{ color: "var(--amber-bright)" }}>
            {sortLabel.toLowerCase()}
          </span>
        </span>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            letterSpacing: 0,
            textTransform: "none"
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--text-dim)"
            }}
          >
            SYNC SCORE
          </span>
          {/* Single (i) explainer — replaces the per-row icons. */}
          <span
            className="group"
            style={{ position: "relative", display: "inline-flex" }}
          >
            <span
              aria-label="What is Sync score?"
              style={{
                width: 16,
                height: 16,
                borderRadius: "50%",
                border: "1px solid var(--border-bright)",
                color: "var(--text-dim)",
                fontSize: 10,
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "help",
                background: "var(--panel)",
                fontFamily: "system-ui, sans-serif"
              }}
            >
              i
            </span>
            <span
              className="opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity"
              style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                right: 0,
                width: 280,
                padding: "12px 14px",
                background: "var(--panel-solid)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                fontSize: 11,
                lineHeight: 1.5,
                color: "var(--text-dim)",
                zIndex: 30,
                boxShadow: "0 16px 36px -12px rgba(0,0,0,0.45)",
                textAlign: "left"
              }}
            >
              <strong
                style={{
                  display: "block",
                  marginBottom: 6,
                  fontSize: 12,
                  color: "var(--text)"
                }}
              >
                Sync score
              </strong>
              How closely you and the other side fit on goals + deal
              prefs + complementary asks/offers. 0% = no overlap, 100%
              = perfect complement. Higher score = your twin is more
              likely to find a win-win.
            </span>
          </span>
          {/* Filter dropdown */}
          <button
            type="button"
            onClick={() => setOpenFilter((v) => !v)}
            style={{
              padding: "5px 10px",
              borderRadius: 999,
              border: "1px solid var(--border-bright)",
              background: openFilter ? "var(--panel-2)" : "transparent",
              color: "var(--text)",
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 4
            }}
          >
            <span>filter</span>
            <span aria-hidden="true">▾</span>
          </button>
          {openFilter && (
            <div
              role="menu"
              style={{
                position: "absolute",
                right: 0,
                marginTop: 30,
                minWidth: 200,
                background: "var(--panel-solid)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                boxShadow: "0 16px 36px -12px rgba(0,0,0,0.45)",
                zIndex: 20,
                overflow: "hidden"
              }}
            >
              {SORTS.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => {
                    setSort(s.key);
                    setOpenFilter(false);
                  }}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "10px 14px",
                    background:
                      sort === s.key ? "var(--panel-2)" : "transparent",
                    border: 0,
                    color: sort === s.key ? "var(--text)" : "var(--text-dim)",
                    fontWeight: sort === s.key ? 700 : 500,
                    fontSize: 13,
                    cursor: "pointer"
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </span>
      </div>

      <div className="mt-3 space-y-2">
        {sorted.map((c) => (
          <div key={c.id} className="retro-panel retro-panel-hover p-3">
            <div className="flex items-start gap-3">
              <Link
                href={`/conversations/${c.id}`}
                className="shrink-0"
              >
                <Avatar
                  id={c.other_id}
                  name={c.other_name}
                  avatarUrl={c.other_avatar}
                  size={40}
                />
              </Link>
              <Link
                href={`/conversations/${c.id}`}
                className="min-w-0 flex-1"
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <div className="font-semibold text-sm flex items-center gap-2 flex-wrap">
                  <span>{c.other_name}</span>
                  {c.status && (
                    <span
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{
                        color: c.status.color,
                        border: `1px solid ${c.status.color}`,
                        background: "transparent",
                        letterSpacing: "0.04em"
                      }}
                    >
                      {c.status.label}
                    </span>
                  )}
                  <SocialIconRow urls={c.other_socials} size={14} />
                </div>
                {c.counterpart_summary && (
                  <div className="retro-dim text-xs mt-1">
                    {c.counterpart_summary}
                  </div>
                )}
                {c.summary && (
                  <div className="text-xs mt-1.5">
                    <span className="retro-dim">outcome: </span>
                    {c.summary}
                  </div>
                )}
                <div className="retro-dim text-[11px] mt-1">
                  <ClientDate value={c.created_at} />
                </div>
              </Link>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-end",
                  gap: 4
                }}
              >
                <span
                  title="Sync score"
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color:
                      c.sync_score >= 70
                        ? "var(--green)"
                        : c.sync_score >= 40
                        ? "var(--amber-bright)"
                        : "var(--text-dim)",
                    fontFamily:
                      '"IBM Plex Mono", ui-monospace, monospace'
                  }}
                >
                  {c.sync_score}%
                </span>
                <ExcitementControl
                  conversationId={c.id}
                  score={c.excitement_score}
                  locked={!!c.excitement_locked}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
