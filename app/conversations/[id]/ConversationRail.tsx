import Link from "next/link";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { Avatar } from "../../Avatar";

/**
 * ConversationRail — narrow vertical strip on the left of the
 * conversation page (desktop only). Lets the user hop between active
 * conversations without going back to /messages. Mounted as a fixed-
 * position element so it doesn't fight ChatUI's `h-screen` layout.
 *
 * On screens < lg it's hidden — mobile uses the back button + the
 * AppShell hamburger drawer for nav.
 *
 * Each item: small avatar + first name + status pip. The active
 * conversation is highlighted. Every link uses prefetch={true} so
 * hopping is instant.
 */
export async function ConversationRail({
  activeId
}: {
  activeId: string;
}) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return null;

  const service = createServiceClient();

  const { data: convs } = await supabase
    .from("conversations")
    .select(
      "id, participant_a, participant_b, status, created_at, excitement_score"
    )
    .or(`participant_a.eq.${user.id},participant_b.eq.${user.id}`)
    .order("created_at", { ascending: false })
    .limit(30);
  const rows = (convs as any[]) ?? [];
  if (rows.length === 0) return null;

  const otherIds = Array.from(
    new Set(
      rows.map((c) => (c.participant_a === user.id ? c.participant_b : c.participant_a))
    )
  );
  const { data: profiles } = await service
    .from("profiles")
    .select("id, display_name, email, avatar_url")
    .in("id", otherIds);
  const profById = new Map<
    string,
    { display_name: string | null; email: string | null; avatar_url: string | null }
  >();
  for (const p of (profiles ?? []) as any[]) {
    profById.set(p.id, {
      display_name: p.display_name ?? null,
      email: p.email ?? null,
      avatar_url: p.avatar_url ?? null
    });
  }

  const firstName = (full: string) => {
    const f = (full || "").trim();
    if (!f) return "—";
    if (f.includes("@")) return f.split("@")[0]!.split(/[._\-+]/)[0]!;
    return f.split(/\s+/)[0]!;
  };

  return (
    <aside
      className="hidden lg:flex"
      style={{
        position: "fixed",
        top: 64,
        bottom: 24,
        left: 16,
        width: 76,
        flexDirection: "column",
        gap: 6,
        padding: 8,
        background: "var(--panel-solid)",
        border: "1px solid var(--border)",
        borderRadius: 14,
        overflowY: "auto",
        zIndex: 5
      }}
    >
      <Link
        href="/messages"
        prefetch={true}
        aria-label="All messages"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 2,
          padding: "6px 4px",
          textDecoration: "none",
          color: "var(--text-dim)",
          fontSize: 9,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          fontWeight: 700,
          borderRadius: 8,
          marginBottom: 4,
          background: "var(--panel-2)"
        }}
      >
        <span style={{ fontSize: 16 }}>☰</span>
        <span>all</span>
      </Link>

      {rows.map((c) => {
        const otherId =
          c.participant_a === user.id ? c.participant_b : c.participant_a;
        const p = profById.get(otherId);
        const fullName = p?.display_name || p?.email || "Someone";
        const fn = firstName(fullName);
        const active = c.id === activeId;
        const dot =
          c.status === "closed"
            ? "var(--green, #3cd870)"
            : c.status === "active"
            ? "var(--amber-bright)"
            : "var(--text-dim)";
        return (
          <Link
            key={c.id}
            href={`/conversations/${c.id}`}
            prefetch={true}
            aria-label={`Open conversation with ${fullName}`}
            aria-current={active ? "page" : undefined}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 3,
              padding: "6px 4px",
              borderRadius: 10,
              textDecoration: "none",
              background: active ? "var(--panel-2)" : "transparent",
              border: active
                ? "1px solid var(--amber)"
                : "1px solid transparent",
              transition: "background 120ms, border-color 120ms"
            }}
          >
            <div style={{ position: "relative" }}>
              <Avatar
                id={otherId}
                name={fullName}
                avatarUrl={p?.avatar_url ?? null}
                size={40}
              />
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  right: -1,
                  bottom: -1,
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  background: dot,
                  border: "2px solid var(--panel-solid)"
                }}
              />
            </div>
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: active ? "var(--text)" : "var(--text-dim)",
                maxWidth: 60,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                textAlign: "center"
              }}
            >
              {fn}
            </span>
          </Link>
        );
      })}
    </aside>
  );
}
