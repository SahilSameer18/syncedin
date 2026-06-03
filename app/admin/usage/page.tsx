import { notFound } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { ClientDate } from "../../ClientDate";

// Live usage analytics — recomputed every load, no caching.
export const dynamic = "force-dynamic";
export const revalidate = 0;

// Hard email gate — only Jack sees this. notFound() so the route's
// existence isn't even revealed to anyone else.
const ADMIN_EMAIL = "jacksonjezio@gmail.com";

const DAY = 24 * 60 * 60 * 1000;

function pct(part: number, whole: number): string {
  if (!whole) return "0%";
  return `${Math.round((part / whole) * 100)}%`;
}

export default async function AdminUsagePage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user || user.email?.toLowerCase() !== ADMIN_EMAIL) {
    notFound();
  }

  const service = createServiceClient();
  const now = Date.now();
  const iso7 = new Date(now - 7 * DAY).toISOString();
  const iso30 = new Date(now - 30 * DAY).toISOString();

  // ── Headline counts (cheap head:true counts) ──────────────────────────────
  const [
    totalUsersR,
    testUsersR,
    new7R,
    new30R,
    twinsBuiltR,
    active7R,
    invTotalR,
    invSentR,
    invVisitedR,
    invClaimedR,
    convTotalR,
    emailTotalR,
    email7R
  ] = await Promise.all([
    service
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("is_test_persona", false),
    service
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("is_test_persona", true),
    service
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("is_test_persona", false)
      .gte("created_at", iso7),
    service
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("is_test_persona", false)
      .gte("created_at", iso30),
    service
      .from("twin_profiles")
      .select("user_id", { count: "exact", head: true })
      .not("goals", "is", null),
    service
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("is_test_persona", false)
      .gte("last_active_at", iso7),
    service.from("pending_invites").select("slug", { count: "exact", head: true }),
    service
      .from("pending_invites")
      .select("slug", { count: "exact", head: true })
      .not("sent_at", "is", null),
    service
      .from("pending_invites")
      .select("slug", { count: "exact", head: true })
      .gt("visit_count", 0),
    service
      .from("pending_invites")
      .select("slug", { count: "exact", head: true })
      .not("claimed_by_user_id", "is", null),
    service.from("conversations").select("id", { count: "exact", head: true }),
    service.from("notification_log").select("id", { count: "exact", head: true }),
    service
      .from("notification_log")
      .select("id", { count: "exact", head: true })
      .gte("sent_at", iso7)
  ]);

  const totalUsers = totalUsersR.count ?? 0;
  const testUsers = testUsersR.count ?? 0;
  const new7 = new7R.count ?? 0;
  const new30 = new30R.count ?? 0;
  const twinsBuilt = twinsBuiltR.count ?? 0;
  const active7 = active7R.count ?? 0;
  const invTotal = invTotalR.count ?? 0;
  const invSent = invSentR.count ?? 0;
  const invVisited = invVisitedR.count ?? 0;
  const invClaimed = invClaimedR.count ?? 0;
  const convTotal = convTotalR.count ?? 0;
  const emailTotal = emailTotalR.count ?? 0;
  const email7 = email7R.count ?? 0;

  // ── Recently active users (engagement recency) ────────────────────────────
  const { data: recentActive } = await service
    .from("profiles")
    .select("id, display_name, email, handle, last_active_at, created_at")
    .eq("is_test_persona", false)
    .not("last_active_at", "is", null)
    .order("last_active_at", { ascending: false })
    .limit(25);

  // ── Power users — aggregate message + invite volume per user in JS ────────
  // Pre-launch scale, so a capped raw fetch + in-memory tally is fine.
  const [{ data: msgRows }, { data: invRows }] = await Promise.all([
    service.from("messages").select("sender_user_id").limit(20000),
    service.from("pending_invites").select("inviter_user_id").limit(20000)
  ]);
  const msgBy = new Map<string, number>();
  for (const r of (msgRows ?? []) as Array<{ sender_user_id: string }>) {
    if (r.sender_user_id)
      msgBy.set(r.sender_user_id, (msgBy.get(r.sender_user_id) ?? 0) + 1);
  }
  const invBy = new Map<string, number>();
  for (const r of (invRows ?? []) as Array<{ inviter_user_id: string }>) {
    if (r.inviter_user_id)
      invBy.set(r.inviter_user_id, (invBy.get(r.inviter_user_id) ?? 0) + 1);
  }
  const allIds = new Set<string>(
    Array.from(msgBy.keys()).concat(Array.from(invBy.keys()))
  );
  const ranked = Array.from(allIds)
    .map((id) => ({
      id,
      messages: msgBy.get(id) ?? 0,
      invites: invBy.get(id) ?? 0,
      score: (msgBy.get(id) ?? 0) + (invBy.get(id) ?? 0)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 15);

  // Resolve names for the leaderboard.
  const nameById = new Map<string, { name: string; handle: string | null }>();
  if (ranked.length > 0) {
    const { data: profs } = await service
      .from("profiles")
      .select("id, display_name, email, handle")
      .in(
        "id",
        ranked.map((r) => r.id)
      );
    for (const p of (profs ?? []) as any[]) {
      nameById.set(p.id, {
        name: p.display_name || p.email || p.id.slice(0, 8),
        handle: p.handle ?? null
      });
    }
  }

  // ── Email volume by kind (last 1000 rows, tallied) ────────────────────────
  const { data: emailRows } = await service
    .from("notification_log")
    .select("kind")
    .order("sent_at", { ascending: false })
    .limit(1000);
  const emailByKind = new Map<string, number>();
  for (const r of (emailRows ?? []) as Array<{ kind: string }>) {
    emailByKind.set(r.kind, (emailByKind.get(r.kind) ?? 0) + 1);
  }
  const emailKinds = Array.from(emailByKind.entries()).sort(
    (a, b) => b[1] - a[1]
  );

  return (
    <main className="max-w-5xl mx-auto px-5 py-8">
      <div className="retro-label">internal · admin only</div>
      <h1 className="retro-h1 text-3xl mt-2">SyncedIn · Usage</h1>
      <p className="mt-2 text-sm" style={{ color: "var(--text-dim)" }}>
        Live from Supabase, recomputed on every load. Test personas excluded
        from user counts. checked {new Date().toISOString()}
      </p>

      {/* ── Headline stat grid ── */}
      <div
        className="mt-6"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: 12
        }}
      >
        <Stat label="Real users" value={totalUsers} sub={`${testUsers} test personas`} />
        <Stat label="Twins built" value={twinsBuilt} sub={`${pct(twinsBuilt, totalUsers)} of users`} />
        <Stat label="Active (7d)" value={active7} sub={`${pct(active7, totalUsers)} of users`} />
        <Stat label="New (7d / 30d)" value={`${new7} / ${new30}`} />
        <Stat label="Conversations" value={convTotal} />
        <Stat label="Emails sent (7d / all)" value={`${email7} / ${emailTotal}`} />
      </div>

      {/* ── Referral funnel — the core retention/virality diagnostic ── */}
      <h2 className="retro-h1 text-xl mt-8">Referral funnel</h2>
      <div className="mt-3 retro-panel" style={{ padding: 16 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
            gap: 12
          }}
        >
          <Stat label="Invites drafted" value={invTotal} />
          <Stat label="Marked sent" value={invSent} sub={`${pct(invSent, invTotal)} of drafted`} />
          <Stat label="Visited link" value={invVisited} sub={`${pct(invVisited, invSent)} of sent`} />
          <Stat label="Claimed (signed up)" value={invClaimed} sub={`${pct(invClaimed, invVisited)} of visits`} />
        </div>
        <p className="mt-3 text-xs" style={{ color: "var(--text-dim)" }}>
          The drop between each stage is where the loop leaks. Sent → visited
          is message quality; visited → claimed is the landing-page + signup
          flow.
        </p>
      </div>

      {/* ── Power users ── */}
      <h2 className="retro-h1 text-xl mt-8">Power users</h2>
      <div className="mt-3 retro-panel" style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left" }}>
              <th style={th}>User</th>
              <th style={th}>Messages</th>
              <th style={th}>Invites</th>
              <th style={th}>Total</th>
            </tr>
          </thead>
          <tbody>
            {ranked.length === 0 && (
              <tr>
                <td style={td} colSpan={4}>
                  No activity yet.
                </td>
              </tr>
            )}
            {ranked.map((r) => {
              const info = nameById.get(r.id);
              return (
                <tr key={r.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={td}>
                    <strong>{info?.name ?? r.id.slice(0, 8)}</strong>
                    {info?.handle && (
                      <span style={{ color: "var(--text-dim)" }}> · /{info.handle}</span>
                    )}
                  </td>
                  <td style={{ ...td, fontFamily: "monospace" }}>{r.messages}</td>
                  <td style={{ ...td, fontFamily: "monospace" }}>{r.invites}</td>
                  <td style={{ ...td, fontFamily: "monospace", fontWeight: 700 }}>
                    {r.score}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Recently active ── */}
      <h2 className="retro-h1 text-xl mt-8">Recently active</h2>
      <div className="mt-3 retro-panel" style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left" }}>
              <th style={th}>User</th>
              <th style={th}>Last active</th>
              <th style={th}>Joined</th>
            </tr>
          </thead>
          <tbody>
            {((recentActive ?? []) as any[]).map((p) => (
              <tr key={p.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={td}>
                  <strong>{p.display_name || p.email}</strong>
                  {p.handle && (
                    <span style={{ color: "var(--text-dim)" }}> · /{p.handle}</span>
                  )}
                </td>
                <td style={{ ...td, color: "var(--text-dim)" }}>
                  <ClientDate value={p.last_active_at} />
                </td>
                <td style={{ ...td, color: "var(--text-dim)" }}>
                  <ClientDate value={p.created_at} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Email breakdown ── */}
      <h2 className="retro-h1 text-xl mt-8">Emails by type</h2>
      <p className="mt-1 text-xs" style={{ color: "var(--text-dim)" }}>
        From notification_log (last 1000). Use this to spot which notifications
        are firing most before deciding what to cut.
      </p>
      <div className="mt-3 retro-panel" style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left" }}>
              <th style={th}>Kind</th>
              <th style={th}>Count</th>
            </tr>
          </thead>
          <tbody>
            {emailKinds.length === 0 && (
              <tr>
                <td style={td} colSpan={2}>
                  No emails logged yet.
                </td>
              </tr>
            )}
            {emailKinds.map(([kind, count]) => (
              <tr key={kind} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={td}>{kind}</td>
                <td style={{ ...td, fontFamily: "monospace" }}>{count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

function Stat({
  label,
  value,
  sub
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="retro-panel" style={{ padding: 14 }}>
      <div className="retro-label" style={{ marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1 }}>{value}</div>
      {sub && (
        <div className="text-xs mt-1" style={{ color: "var(--text-dim)" }}>
          {sub}
        </div>
      )}
    </div>
  );
}

const th: React.CSSProperties = {
  padding: "10px 12px",
  fontSize: 12,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "var(--text-dim)",
  borderBottom: "1px solid var(--border)"
};
const td: React.CSSProperties = {
  padding: "10px 12px",
  fontSize: 13,
  verticalAlign: "top"
};
