import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { ExcitementControl } from "../dashboard/ExcitementControl";
import { Avatar } from "../Avatar";
import { AppShell } from "../AppShell";
import { ConversationPrefetch } from "./ConversationPrefetch";

export const metadata = {
  title: "Messages · SyncedIn"
};

export default async function MessagesPage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const service = createServiceClient();

  const { data: conversations } = await supabase
    .from("conversations")
    .select(
      "id, participant_a, participant_b, status, created_at, summary, counterpart_summary, excitement_score, excitement_locked"
    )
    .or(`participant_a.eq.${user.id},participant_b.eq.${user.id}`)
    .order("created_at", { ascending: false });

  const otherIds = (conversations ?? []).map((c) =>
    c.participant_a === user.id ? c.participant_b : c.participant_a
  );
  const { data: others } = otherIds.length
    ? await service
        .from("profiles")
        .select("id, display_name, email, is_test_persona, avatar_url")
        .in("id", otherIds)
    : { data: [] as any[] };
  const profileById = new Map(
    (others ?? []).map((p) => [p.id, p] as const)
  );
  const nameById = new Map(
    (others ?? []).map((p) => [p.id, p.display_name || p.email] as const)
  );
  const isTestById = new Map(
    (others ?? []).map((p) => [p.id, p.is_test_persona] as const)
  );

  const sorted = (conversations ?? []).sort(
    (a, b) => (b.excitement_score ?? -1) - (a.excitement_score ?? -1)
  );

  // Status badges — same logic as dashboard so the two surfaces stay
  // consistent: sealed / your turn / waiting on {first} / negotiating.
  const convIds = (conversations ?? []).map((c) => c.id);
  type AgrResp = { conversation_id: string; user_id: string; response: string };
  const { data: allResps } = convIds.length
    ? await service
        .from("agreement_responses")
        .select("conversation_id, user_id, response")
        .in("conversation_id", convIds)
    : { data: [] as AgrResp[] };
  const respsByConv = new Map<string, AgrResp[]>();
  for (const r of (allResps ?? []) as AgrResp[]) {
    const list = respsByConv.get(r.conversation_id) ?? [];
    list.push(r);
    respsByConv.set(r.conversation_id, list);
  }
  function statusForConv(c: {
    id: string;
    participant_a: string;
    participant_b: string;
  }):
    | { kind: "sealed"; label: string; color: string }
    | { kind: "your_turn"; label: string; color: string }
    | { kind: "waiting"; label: string; color: string }
    | { kind: "negotiating"; label: string; color: string }
    | null {
    const rs = respsByConv.get(c.id) ?? [];
    const mine = rs.find((r) => r.user_id === user!.id);
    const otherId =
      c.participant_a === user!.id ? c.participant_b : c.participant_a;
    const theirs = rs.find((r) => r.user_id === otherId);
    if (mine?.response === "accepted" && theirs?.response === "accepted") {
      return { kind: "sealed", label: "✓ deal sealed", color: "var(--green)" };
    }
    if (theirs?.response === "accepted" && !mine) {
      return {
        kind: "your_turn",
        label: "→ your turn",
        color: "var(--amber-bright)"
      };
    }
    if (mine?.response === "accepted" && !theirs) {
      const otherName = (nameById.get(otherId) ?? "them") as string;
      return {
        kind: "waiting",
        label: `⏳ waiting on ${otherName.split(/\s+/)[0]}`,
        color: "var(--text-dim)"
      };
    }
    if (rs.length > 0) {
      return {
        kind: "negotiating",
        label: "↻ negotiating",
        color: "var(--text-dim)"
      };
    }
    return null;
  }

  return (
    <AppShell>
      <h1 className="retro-h1 text-3xl">Messages</h1>
      <p className="retro-dim text-sm mt-2">
        Every conversation your twin is having or has had. Sorted by Sync
        score, so the highest-leverage ones surface first.
      </p>

      {sorted.length === 0 ? (
        <div className="mt-8 retro-panel p-6 text-sm">
          <div className="font-semibold">No messages yet.</div>
          <div className="retro-dim mt-1">
            Start your first conversation from the dashboard. Your twin will
            pick up the back-and-forth for you.
          </div>
          <Link
            href="/dashboard"
            className="retro-btn retro-btn-primary mt-4 inline-flex"
          >
            Go to dashboard
          </Link>
        </div>
      ) : (
        <div className="mt-6 space-y-2">
          {/* Warm the Next.js route bundle cache for every visible
              conversation so clicks land on the loading.tsx skeleton
              in <50ms, then stream the real page in. */}
          <ConversationPrefetch ids={sorted.map((c) => c.id)} />
          {sorted.map((c) => {
            const otherId =
              c.participant_a === user.id ? c.participant_b : c.participant_a;
            const isTest = isTestById.get(otherId);
            return (
              <div
                key={c.id}
                className="retro-panel retro-panel-hover p-3"
                style={{ position: "relative", paddingRight: 44 }}
              >
                {/* Always-visible chevron — same affordance as poll list
                    cards. Previous version had pointer-events:none and
                    the parent <div> wasn't a link, so clicks on the
                    chevron landed on dead space. Now the chevron IS a
                    Link with prefetch so tapping it navigates straight
                    into the conversation. */}
                <Link
                  href={`/conversations/${c.id}`}
                  prefetch={true}
                  aria-label={`Open conversation with ${nameById.get(otherId) ?? "this person"}`}
                  style={{
                    position: "absolute",
                    right: 14,
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    border: "1px solid var(--border-bright)",
                    background: "var(--panel-2)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--text-dim)",
                    fontSize: 13,
                    fontWeight: 700,
                    textDecoration: "none"
                  }}
                >
                  →
                </Link>
                <div className="flex items-start gap-3">
                  <Link
                    href={`/conversations/${c.id}`}
                    prefetch={true}
                    className="shrink-0"
                  >
                    <Avatar
                      id={otherId}
                      name={nameById.get(otherId) ?? "Unknown"}
                      avatarUrl={profileById.get(otherId)?.avatar_url ?? null}
                      size={44}
                    />
                  </Link>
                  <Link
                    href={`/conversations/${c.id}`}
                    prefetch={true}
                    className="min-w-0 flex-1"
                  >
                    <div className="font-semibold text-sm flex items-center gap-2 flex-wrap">
                      <span>{nameById.get(otherId) ?? "Unknown"}</span>
                      {(() => {
                        const st = statusForConv(c);
                        if (!st) return null;
                        return (
                          <span
                            className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                            style={{
                              color: st.color,
                              border: `1px solid ${st.color}`,
                              background: "transparent",
                              letterSpacing: "0.04em"
                            }}
                          >
                            {st.label}
                          </span>
                        );
                      })()}
                      {isTest && (
                        <span
                          className="retro-dim text-[10px]"
                          style={{
                            border: "1px solid var(--border-bright)",
                            padding: "1px 6px",
                            borderRadius: 4
                          }}
                        >
                          sample
                        </span>
                      )}
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
                      {new Date(c.created_at).toLocaleString()}
                    </div>
                  </Link>
                  <ExcitementControl
                    conversationId={c.id}
                    score={c.excitement_score}
                    locked={c.excitement_locked}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
