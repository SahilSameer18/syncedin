import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { Wordmark } from "../Wordmark";
import {
  startTestConversation,
  startConversationWithUser
} from "./actions";
import { signOut } from "../login/actions";
import { InviteContacts } from "./InviteContacts";
import { ExaDiscover } from "./ExaDiscover";
import { ExcitementControl } from "./ExcitementControl";
import { ThemeToggle } from "../ThemeToggle";
import { SyncMeter } from "../SyncMeter";
import { SummaryBackfill } from "./SummaryBackfill";

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const service = createServiceClient();

  // Current user's full twin record (used for Sync %)
  const { data: twin } = await supabase
    .from("twin_profiles")
    .select(
      "user_id, goals, deal_preferences, communication_style, deal_breakers, ai_export_blob"
    )
    .eq("user_id", user.id)
    .maybeSingle();
  const { data: myProfile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();
  const twinComplete = Boolean(twin?.goals);

  // This user's conversations
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
        .select("id, display_name, email, is_test_persona")
        .in("id", otherIds)
    : { data: [] as any[] };
  const nameById = new Map(
    (others ?? []).map((p) => [p.id, p.display_name || p.email] as const)
  );
  const isTestById = new Map(
    (others ?? []).map((p) => [p.id, p.is_test_persona] as const)
  );

  // Sample twins (test personas)
  const { data: testPersonas } = await service
    .from("profiles")
    .select("id, display_name, email")
    .eq("is_test_persona", true)
    .order("display_name", { ascending: true });
  const personaIds = (testPersonas ?? []).map((p) => p.id);
  const { data: personaTwins } = personaIds.length
    ? await service
        .from("twin_profiles")
        .select("user_id, goals")
        .in("user_id", personaIds)
    : { data: [] as any[] };
  const personaGoal = new Map(
    (personaTwins ?? []).map((t) => [t.user_id, t.goals ?? ""] as const)
  );

  // Directory: every real user with a completed twin (besides me)
  const { data: allRealUsers } = await service
    .from("profiles")
    .select("id, display_name, email")
    .eq("is_test_persona", false)
    .neq("id", user.id);
  const realUserIds = (allRealUsers ?? []).map((p) => p.id);
  const { data: realTwins } = realUserIds.length
    ? await service
        .from("twin_profiles")
        .select("user_id, goals, deal_preferences")
        .in("user_id", realUserIds)
    : { data: [] as any[] };
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
    completed_conversations: completedConvIds.length,
    accepted_agreements: acceptedAgreementsCount ?? 0
  };

  return (
    <main className="max-w-5xl mx-auto px-5 py-8">
      {/* Fire-and-forget backfill for missing summaries/scores */}
      <SummaryBackfill conversationIds={needsBackfillIds} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <Wordmark />
        <div className="flex items-center gap-3 text-sm">
          <ThemeToggle />
          <Link href="/onboarding" className="retro-dim hover:text-white">
            edit twin
          </Link>
          <form action={signOut}>
            <button className="retro-dim hover:text-white">sign out</button>
          </form>
          <Link
            href="/conversations/new"
            className="retro-btn retro-btn-primary"
          >
            + new
          </Link>
        </div>
      </div>

      {/* SyncMeter hero — your gamified clone */}
      <section className="mt-8 retro-panel retro-shadow p-8">
        <div className="grid md:grid-cols-[auto_1fr] gap-10 items-center">
          <SyncMeter inputs={syncInputs} size={240} />
          <div>
            <div className="retro-label">your twin</div>
            <h1 className="retro-h1 text-4xl mt-3 leading-tight">
              Sync your clone to{" "}
              <span style={{ color: "var(--amber-bright)" }}>99%</span>
            </h1>
            <Link
              href="/onboarding"
              className="retro-btn retro-btn-primary mt-6 inline-flex"
            >
              + add context
            </Link>
          </div>
        </div>
      </section>

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

      {/* People on SyncedIn — the discovery directory */}
      <section className="mt-8">
        <div className="retro-label">
          discover ({directory.length})
        </div>
        <p className="mt-1 retro-dim text-xs">
          People here with a finished twin you haven&apos;t talked to yet.
          Connect and your twins draft the conversation from both sides.
        </p>
        <div className="mt-3 space-y-2">
          {directory.length === 0 && (
            <div className="retro-panel p-4 text-sm">
              <div className="font-semibold">You&apos;re caught up on discovery.</div>
              <div className="retro-dim mt-1">
                Everyone with a finished twin is already in your conversations.
                Grow the network — invite people below, and very soon your twin
                will search the open web for new high-leverage matches.
              </div>
            </div>
          )}
          {directory.map((p) => (
            <form
              action={startConversationWithUser}
              key={p.id}
              className="retro-panel retro-panel-hover p-4 flex items-start justify-between gap-4"
            >
              <div className="min-w-0">
                <div className="font-semibold text-sm">
                  {p.display_name || p.email}
                </div>
                <div className="retro-dim text-xs mt-1 line-clamp-2">
                  {p.goals}
                </div>
              </div>
              <input type="hidden" name="userId" value={p.id} />
              <button
                type="submit"
                className="retro-btn text-xs shrink-0 self-center"
              >
                connect &gt;
              </button>
            </form>
          ))}
        </div>
      </section>

      {/* Real conversations — sorted by excitement */}
      {realConversations.length > 0 && (
        <section className="mt-8">
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
                  <div className="flex items-start justify-between gap-3">
                    <Link
                      href={`/conversations/${c.id}`}
                      className="min-w-0 flex-1"
                    >
                      <div className="font-semibold text-sm">
                        {nameById.get(otherId) ?? "Unknown"}
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
        <section className="mt-8">
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

      {/* Discover with Exa — find people to connect with */}
      <section className="mt-8">
        <ExaDiscover />
      </section>

      {/* Invite */}
      <section className="mt-8">
        <InviteContacts appUrl={appUrl} />
      </section>
    </main>
  );
}
