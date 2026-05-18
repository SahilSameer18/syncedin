import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { ExcitementControl } from "../dashboard/ExcitementControl";
import { Avatar } from "../Avatar";
import { AppShell } from "../AppShell";

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
          {sorted.map((c) => {
            const otherId =
              c.participant_a === user.id ? c.participant_b : c.participant_a;
            const isTest = isTestById.get(otherId);
            return (
              <div key={c.id} className="retro-panel retro-panel-hover p-3">
                <div className="flex items-start gap-3">
                  <Link
                    href={`/conversations/${c.id}`}
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
                    className="min-w-0 flex-1"
                  >
                    <div className="font-semibold text-sm flex items-center gap-2">
                      {nameById.get(otherId) ?? "Unknown"}
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
