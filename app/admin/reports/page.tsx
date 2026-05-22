import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { CopyButton } from "./CopyButton";

/**
 * Admin error reports dashboard. Jack's call: "people shouldn't be
 * finding bugs or errors ever. And if someone does encounter a bug, we
 * need to log that and put that on the reports page so I can copy paste
 * it back to you to fix it."
 *
 * Reads from the existing `feedback` table — both manual feedback widget
 * submissions AND the auto-captured errors that ErrorAutoReport.tsx +
 * /api/error-report write with surface='auto-error*'. Auto-errors are
 * grouped by message signature so a 1000x render-loop error doesn't
 * flood the inbox; manual feedback gets one row each.
 *
 * Gated to jacksonjezio@gmail.com — anyone else gets a 404 (route doesn't
 * leak its existence).
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

const ADMIN_EMAIL = "jacksonjezio@gmail.com";

type FeedbackRow = {
  id: string;
  user_id: string | null;
  message: string;
  surface: string | null;
  user_agent: string | null;
  created_at: string;
  image_data_url: string | null;
};

type GroupedError = {
  signature: string;
  message: string;
  count: number;
  first_seen: string;
  last_seen: string;
  surfaces: Set<string>;
  user_ids: Set<string>;
  sample: FeedbackRow;
};

function signatureOf(message: string): string {
  // Strip absolute timestamps, UUIDs, hex addresses so similar errors group.
  return message
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "<uuid>")
    .replace(/0x[0-9a-f]+/gi, "<hex>")
    .replace(/\b\d{6,}\b/g, "<n>")
    .replace(/https?:\/\/\S+/gi, "<url>")
    .slice(0, 220);
}

export default async function AdminReportsPage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user || user.email?.toLowerCase() !== ADMIN_EMAIL) {
    notFound();
  }

  const service = createServiceClient();
  // Pull the last 500 reports — auto-errors + manual feedback.
  const { data } = await service
    .from("feedback")
    .select("id, user_id, message, surface, user_agent, created_at, image_data_url")
    .order("created_at", { ascending: false })
    .limit(500);
  const rows = (data as FeedbackRow[] | null) ?? [];

  // Split into manual feedback (surface NOT starting with 'auto-error')
  // and auto errors. Auto errors get grouped by signature.
  const manual: FeedbackRow[] = [];
  const grouped = new Map<string, GroupedError>();
  for (const r of rows) {
    if (r.surface && r.surface.startsWith("auto-error")) {
      const sig = signatureOf(r.message);
      const existing = grouped.get(sig);
      if (existing) {
        existing.count += 1;
        existing.last_seen = r.created_at > existing.last_seen ? r.created_at : existing.last_seen;
        existing.first_seen = r.created_at < existing.first_seen ? r.created_at : existing.first_seen;
        if (r.surface) existing.surfaces.add(r.surface);
        if (r.user_id) existing.user_ids.add(r.user_id);
      } else {
        grouped.set(sig, {
          signature: sig,
          message: r.message,
          count: 1,
          first_seen: r.created_at,
          last_seen: r.created_at,
          surfaces: new Set(r.surface ? [r.surface] : []),
          user_ids: new Set(r.user_id ? [r.user_id] : []),
          sample: r
        });
      }
    } else {
      manual.push(r);
    }
  }

  // Lookup user emails for any user_ids we encountered, so each row can
  // show "errored: jack@..." instead of a raw UUID.
  const allUserIds = new Set<string>();
  for (const g of Array.from(grouped.values())) {
    Array.from(g.user_ids).forEach((u) => allUserIds.add(u));
  }
  for (const m of manual) {
    if (m.user_id) allUserIds.add(m.user_id);
  }
  const userIdList = Array.from(allUserIds);
  const userMap = new Map<string, { display_name: string | null; email: string | null }>();
  if (userIdList.length > 0) {
    const { data: profiles } = await service
      .from("profiles")
      .select("id, display_name, email")
      .in("id", userIdList);
    for (const p of (profiles as any[]) ?? []) {
      userMap.set(p.id, {
        display_name: p.display_name ?? null,
        email: p.email ?? null
      });
    }
  }
  function userLabel(id: string | null): string {
    if (!id) return "(signed-out)";
    const p = userMap.get(id);
    if (!p) return id.slice(0, 8);
    return p.display_name || p.email || id.slice(0, 8);
  }

  const groupedList = Array.from(grouped.values()).sort((a, b) => {
    // Open / unresolved feel: most-recent FIRST within same count, then by count
    if (a.last_seen !== b.last_seen) {
      return a.last_seen < b.last_seen ? 1 : -1;
    }
    return b.count - a.count;
  });

  return (
    <main className="max-w-5xl mx-auto px-5 py-8">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <div className="retro-label">internal · admin only</div>
          <h1 className="retro-h1 text-3xl mt-2">Error reports</h1>
        </div>
        <Link href="/admin/status" className="retro-btn text-sm">
          system status →
        </Link>
      </div>

      <p className="mt-3 text-sm" style={{ color: "var(--text-dim)" }}>
        Every uncaught client error + every feedback submission lands here.
        Click <strong>copy</strong> on any row to grab a clean error blob
        you can paste into the next Claude session. Auto-errors are grouped
        by signature — same bug from 12 users shows up once with{" "}
        <code>count: 12</code>.
      </p>

      <div
        className="mt-4 flex gap-3 text-sm"
        style={{ color: "var(--text-dim)" }}
      >
        <span>
          <strong style={{ color: "#ef4444" }}>{groupedList.length}</strong>{" "}
          unique auto-errors
        </span>
        <span>
          <strong style={{ color: "var(--text)" }}>{manual.length}</strong>{" "}
          manual feedback
        </span>
        <span>
          checked at {new Date().toISOString()}
        </span>
      </div>

      <section className="mt-8">
        <h2
          style={{
            fontSize: 14,
            fontWeight: 800,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#ef4444",
            marginBottom: 12
          }}
        >
          Auto-captured errors ({groupedList.length})
        </h2>
        {groupedList.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-dim)" }}>
            Nothing flying. Quiet skies.
          </p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {groupedList.map((g) => {
              const usersLabel = Array.from(g.user_ids)
                .map((u) => userLabel(u))
                .slice(0, 3)
                .join(", ");
              const moreUsers = g.user_ids.size - 3;
              const surfacesLabel = Array.from(g.surfaces)
                .slice(0, 2)
                .join(" · ");
              const copyBlob = [
                `# Error: ${g.message}`,
                `count: ${g.count}`,
                `first_seen: ${g.first_seen}`,
                `last_seen: ${g.last_seen}`,
                `users: ${usersLabel}${
                  moreUsers > 0 ? ` (+${moreUsers} more)` : ""
                }`,
                `surfaces: ${surfacesLabel || "(none)"}`,
                ``,
                `## Latest details`,
                g.sample.message,
                ``,
                `surface: ${g.sample.surface}`,
                `user_agent: ${g.sample.user_agent}`
              ].join("\n");
              return (
                <li
                  key={g.signature}
                  className="retro-panel"
                  style={{
                    padding: 14,
                    marginBottom: 10,
                    borderLeft: "3px solid #ef4444"
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      alignItems: "flex-start"
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          fontFamily: "monospace",
                          fontSize: 13,
                          fontWeight: 700,
                          color: "var(--text)",
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                          marginBottom: 6
                        }}
                      >
                        {g.message.split("\n")[0].slice(0, 240)}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--text-dim)",
                          lineHeight: 1.6,
                          fontFamily: "monospace"
                        }}
                      >
                        <strong style={{ color: "#ef4444" }}>×{g.count}</strong>{" "}
                        · last {new Date(g.last_seen).toLocaleString()}
                        {" · "}
                        users: {usersLabel || "(signed-out)"}
                        {moreUsers > 0 ? ` (+${moreUsers})` : ""}
                        {surfacesLabel && (
                          <>
                            {" · "}
                            <span style={{ color: "var(--text-dim)" }}>
                              {surfacesLabel}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <CopyButton text={copyBlob} label="copy" />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2
          style={{
            fontSize: 14,
            fontWeight: 800,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--text)",
            marginBottom: 12
          }}
        >
          Manual feedback ({manual.length})
        </h2>
        {manual.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-dim)" }}>
            No manual reports.
          </p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {manual.slice(0, 60).map((m) => (
              <li
                key={m.id}
                className="retro-panel"
                style={{
                  padding: 14,
                  marginBottom: 10
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    alignItems: "flex-start"
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        fontSize: 13,
                        color: "var(--text)",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                        marginBottom: 6
                      }}
                    >
                      {m.message.slice(0, 600)}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--text-dim)"
                      }}
                    >
                      {userLabel(m.user_id)} ·{" "}
                      {new Date(m.created_at).toLocaleString()}
                      {m.surface && ` · ${m.surface}`}
                    </div>
                  </div>
                  <CopyButton
                    text={`# Feedback from ${userLabel(m.user_id)} (${
                      m.created_at
                    })\n\n${m.message}\n\nsurface: ${m.surface ?? ""}\nuser_agent: ${
                      m.user_agent ?? ""
                    }`}
                    label="copy"
                  />
                </div>
                {m.image_data_url && (
                  <img
                    src={m.image_data_url}
                    alt="screenshot"
                    style={{
                      maxWidth: 360,
                      marginTop: 10,
                      borderRadius: 8,
                      border: "1px solid var(--border)"
                    }}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
