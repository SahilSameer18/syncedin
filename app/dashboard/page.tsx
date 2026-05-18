import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import {
  startTestConversation,
  startConversationWithUser
} from "./actions";
import { BulkReachToolkit } from "../BulkReachToolkit";
import { ExcitementControl } from "./ExcitementControl";
import { SyncMeter } from "../SyncMeter";
import { SummaryBackfill } from "./SummaryBackfill";
import { DiscoverSearch } from "./DiscoverSearch";
import { Avatar } from "../Avatar";
import { AppShell } from "../AppShell";

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const service = createServiceClient();

  // ── Invite gate ─────────────────────────────────────────────────────
  // New users must draft at least 2 personalized invites before getting
  // full dashboard access. The hypernetwork only works when the people
  // each member actually wants to coordinate with come in too.
  const { count: myInviteCount } = await service
    .from("pending_invites")
    .select("slug", { count: "exact", head: true })
    .eq("inviter_user_id", user.id);
  if ((myInviteCount ?? 0) < 2) {
    redirect("/onboarding/invite-gate");
  }

  // Parallelize the independent first wave: my twin, my profile, my
  // conversations, sample personas, all real users for discovery.
  const [
    { data: twin },
    { data: myProfile },
    { data: conversations },
    { data: testPersonas },
    { data: allRealUsers }
  ] = await Promise.all([
    supabase
      .from("twin_profiles")
      .select(
        "user_id, goals, deal_preferences, communication_style, deal_breakers, ai_export_blob, hometown, current_city"
      )
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("conversations")
      .select(
        "id, participant_a, participant_b, status, created_at, summary, counterpart_summary, excitement_score, excitement_locked"
      )
      .or(`participant_a.eq.${user.id},participant_b.eq.${user.id}`)
      .order("created_at", { ascending: false }),
    service
      .from("profiles")
      .select("id, display_name, email")
      .eq("is_test_persona", true)
      .order("display_name", { ascending: true }),
    service
      .from("profiles")
      .select("id, display_name, email")
      .eq("is_test_persona", false)
      .neq("id", user.id)
  ]);

  const twinComplete = Boolean(twin?.goals);

  const otherIds = (conversations ?? []).map((c) =>
    c.participant_a === user.id ? c.participant_b : c.participant_a
  );
  const personaIds = (testPersonas ?? []).map((p) => p.id);
  const realUserIds = (allRealUsers ?? []).map((p) => p.id);

  // Parallelize the second wave that depends on the first.
  const [
    { data: others },
    { data: personaTwins },
    { data: realTwins }
  ] = await Promise.all([
    otherIds.length
      ? service
          .from("profiles")
          .select("id, display_name, email, is_test_persona, avatar_url")
          .in("id", otherIds)
      : Promise.resolve({ data: [] as any[] }),
    personaIds.length
      ? service
          .from("twin_profiles")
          .select("user_id, goals")
          .in("user_id", personaIds)
      : Promise.resolve({ data: [] as any[] }),
    realUserIds.length
      ? service
          .from("twin_profiles")
          .select("user_id, goals, deal_preferences")
          .in("user_id", realUserIds)
      : Promise.resolve({ data: [] as any[] })
  ]);

  const nameById = new Map(
    (others ?? []).map((p) => [p.id, p.display_name || p.email] as const)
  );
  const isTestById = new Map(
    (others ?? []).map((p) => [p.id, p.is_test_persona] as const)
  );
  const avatarById = new Map(
    (others ?? []).map((p) => [p.id, p.avatar_url ?? null] as const)
  );
  const personaGoal = new Map(
    (personaTwins ?? []).map((t) => [t.user_id, t.goals ?? ""] as const)
  );
  const twinByUser = new Map(
    (realTwins ?? []).map((t) => [t.user_id, t] as const)
  );
  // Discovery directory: real users with a finished twin you're NOT already
  // in a conversation with. Once you've connected, they drop off discovery —
  // the space below pivots to inviting more people.
  const existingConvoIds = new Set(otherIds);
  const directory = (allRealUsers ?? [])
    .map((p) => ({
      ...p,
      goals: twinByUser.get(p.id)?.goals ?? null,
      deal_preferences: twinByUser.get(p.id)?.deal_preferences ?? null
    }))
    .filter((p) => p.goals && !existingConvoIds.has(p.id));

  const realConversations = (conversations ?? [])
    .filter(
      (c) =>
        !isTestById.get(
          c.participant_a === user.id ? c.participant_b : c.participant_a
        )
    )
    // Sort by excitement, highest first; unscored conversations fall to the end.
    .sort(
      (a, b) =>
        (b.excitement_score ?? -1) - (a.excitement_score ?? -1)
    );
  const testConversations = (conversations ?? []).filter((c) =>
    isTestById.get(
      c.participant_a === user.id ? c.participant_b : c.participant_a
    )
  );

  // For Sync %: count completed conversations + accepted agreements.
  const completedConvIds = (conversations ?? [])
    .filter((c) => c.status === "closed")
    .map((c) => c.id);
  const { count: acceptedAgreementsCount } = await service
    .from("agreement_responses")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("response", "accepted");

  // Edits captured — every time the user corrected a draft. Drives the
  // "edits captured" bucket in the Sync %.
  const { count: editCount } = await service
    .from("edit_deltas")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  // Status pills per conversation: sealed / your-turn / waiting / negotiating.
  // Pull all agreement_responses for the user's conversations once.
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
      const otherName = nameById.get(otherId) ?? "them";
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

  // Backfill any conversation missing a summary or excitement score.
  const needsBackfillIds = (conversations ?? [])
    .filter(
      (c) =>
        !isTestById.get(
          c.participant_a === user.id ? c.participant_b : c.participant_a
        ) &&
        (c.summary == null || c.excitement_score == null)
    )
    .map((c) => c.id);

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "https://syncedin.org";

  const syncInputs = {
    name: myProfile?.display_name ?? null,
    goals: twin?.goals ?? null,
    ai_export_blob: twin?.ai_export_blob ?? null,
    deal_preferences: twin?.deal_preferences ?? null,
    comm_style: twin?.communication_style ?? null,
    deal_breakers: twin?.deal_breakers ?? null,
    hometown: (twin as any)?.hometown ?? null,
    current_city: (twin as any)?.current_city ?? null,
    completed_conversations: completedConvIds.length,
    accepted_agreements: acceptedAgreementsCount ?? 0,
    edit_count: editCount ?? 0
  };

  return (
    <AppShell maxWidth="max-w-7xl">
      {/* Fire-and-forget backfill for missing summaries/scores */}
      <SummaryBackfill conversationIds={needsBackfillIds} />

      <>
        {!twinComplete && (
          <div
            className="mt-6 retro-panel p-4 text-sm"
            style={{ borderColor: "var(--amber)" }}
          >
            <span className="retro-amber font-semibold">! </span>
            Your twin is incomplete.{" "}
            <Link href="/onboarding" className="retro-amber underline">
              Finish onboarding
            </Link>{" "}
            so it has enough context to represent you.
          </div>
        )}

        {/* Two-column inner: SyncMeter (sticky) + Discover/everything */}
        <div className="mt-8 grid md:grid-cols-[260px_1fr] gap-8 items-start">
        {/* LEFT — clone meter */}
        <aside className="md:sticky md:top-6 flex flex-col items-center gap-4">
          <SyncMeter
            inputs={syncInputs}
            size={220}
            avatarUrl={(myProfile as any)?.avatar_url ?? null}
            userId={user.id}
          />
          <Link
            href="/onboarding"
            className="retro-btn retro-btn-primary w-full text-center"
          >
            + add context
          </Link>
          <div
            className="retro-dim text-xs text-center"
            style={{ maxWidth: 240 }}
          >
            Sync your clone to{" "}
            <span style={{ color: "var(--amber-bright)", fontWeight: 700 }}>
              99%
            </span>
            . The last 1% is on purpose — a twin is never truly finished.
          </div>
        </aside>

        {/* RIGHT — main content, Discover at top */}
        <div className="space-y-8">
          <DiscoverSearch directory={directory} />

          {/* Real conversations — sorted by excitement */}
          {realConversations.length > 0 && (
        <section>
          <div className="retro-label">
            your conversations · sorted by excitement
          </div>
          <div className="mt-3 space-y-2">
            {realConversations.map((c) => {
              const otherId =
                c.participant_a === user.id
                  ? c.participant_b
                  : c.participant_a;
              return (
                <div
                  key={c.id}
                  className="retro-panel retro-panel-hover p-3"
                >
                  <div className="flex items-start gap-3">
                    <Link
                      href={`/conversations/${c.id}`}
                      className="shrink-0"
                    >
                      <Avatar
                        id={otherId}
                        name={nameById.get(otherId) ?? "Unknown"}
                        avatarUrl={avatarById.get(otherId) ?? null}
                        size={40}
                      />
                    </Link>
                    <Link
                      href={`/conversations/${c.id}`}
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
        </section>
      )}

          {/* Sample twins */}
          {twinComplete && (testPersonas?.length ?? 0) > 0 && (
        <section>
          <div className="retro-label">test against a sample twin</div>
          <p className="mt-1 retro-dim text-xs">
            Pre-built twins that auto-reply. Stress-test yours before bringing
            real people in.
          </p>
          <div className="mt-3 grid sm:grid-cols-2 gap-2">
            {(testPersonas ?? []).map((p) => (
              <form action={startTestConversation} key={p.id}>
                <input type="hidden" name="personaId" value={p.id} />
                <button
                  type="submit"
                  className="w-full text-left retro-panel retro-panel-hover p-3"
                >
                  <div className="font-semibold text-sm">
                    {p.display_name ?? p.email}
                  </div>
                  <div className="retro-dim text-[11px] mt-1 line-clamp-2">
                    {personaGoal.get(p.id) || ""}
                  </div>
                </button>
              </form>
            ))}
          </div>
          {testConversations.length > 0 && (
            <div className="mt-2 space-y-1.5">
              {testConversations.map((c) => {
                const otherId =
                  c.participant_a === user.id
                    ? c.participant_b
                    : c.participant_a;
                return (
                  <Link
                    key={c.id}
                    href={`/conversations/${c.id}`}
                    className="block retro-panel retro-panel-hover px-3 py-2 text-xs"
                  >
                    <span className="retro-dim">resume: </span>
                    {nameById.get(otherId) ?? "Unknown"}
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      )}

          {/* Invite */}
          <section>
            <BulkReachToolkit appUrl={appUrl} variant="card" />
          </section>
        </div>
        </div>
      </>
    </AppShell>
  );
}
