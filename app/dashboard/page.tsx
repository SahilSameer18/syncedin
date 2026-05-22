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
import { ScrollTopOnSaved } from "./ScrollTopOnSaved";
import { Avatar } from "../Avatar";
import { AppShell } from "../AppShell";
import { computePairScore } from "@/lib/pair-score";
import { QuickFeedbackWidget } from "./QuickFeedbackWidget";
import { PremiumProgressCard } from "./PremiumProgressCard";

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const service = createServiceClient();

  // ── Invite gate DISABLED ────────────────────────────────────────────
  // Real-user feedback: the hard 2-invite requirement felt like an
  // interrogation. The user added 2 emails + sent via a broadcast
  // channel, the gate (which only counts generated personalized invites)
  // still blocked them — same screen, same message, no path forward.
  //
  // Invites should be encouragement, not a dashboard-blocking gate.
  // Keeping the count fetch in case a softer prompt wants to surface
  // ("you've sent N invites — try the personalized flow next") later.
  const { count: myInviteCount } = await service
    .from("pending_invites")
    .select("slug", { count: "exact", head: true })
    .eq("inviter_user_id", user.id);
  void myInviteCount;

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
      .select("id, display_name, email, avatar_url")
      .eq("is_test_persona", false)
      .neq("id", user.id)
  ]);

  const twinComplete = Boolean(twin?.goals);

  // Premium-unlock counter: count distinct users who claimed an invite
  // from THIS user AND completed their twin (twin_profiles.goals set).
  // Computed here (not inline in JSX) so the build doesn't trip on an
  // async-IIFE-inside-JSX pattern Next 14's compiler gets weird about.
  let completedReferrals = 0;
  try {
    const { data: claimedRows } = await service
      .from("pending_invites")
      .select("claimed_by_user_id")
      .eq("inviter_user_id", user.id)
      .not("claimed_by_user_id", "is", null);
    const claimedIds = Array.from(
      new Set(
        ((claimedRows ?? []) as any[])
          .map((r) => r.claimed_by_user_id)
          .filter(Boolean)
      )
    );
    if (claimedIds.length > 0) {
      const { data: completedTwins } = await service
        .from("twin_profiles")
        .select("user_id")
        .in("user_id", claimedIds)
        .not("goals", "is", null);
      completedReferrals = (completedTwins ?? []).length;
    }
  } catch {
    /* silent — card shows 0/3 */
  }

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
          .select(
            "user_id, goals, deal_preferences, ai_export_blob, communication_style, deal_breakers"
          )
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
  /**
   * Lightweight token-overlap score between two twin profiles. Returns
   * 0-100. Token similarity over (goals + deal_preferences + ai_export_blob
   * + communication_style) with a tiny floor so even thin-profile matches
   * get a non-zero number. Server-side and instant — no LLM call needed
   * to display these on first paint. Good enough as a "warm hint" until we
   * upgrade to a Claude-scored job that runs once per (a,b) pair.
   */
  function jaccardScore(a: string, b: string): number {
    const norm = (s: string) =>
      (s || "")
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 3);
    const STOP = new Set([
      "with",
      "from",
      "that",
      "this",
      "have",
      "your",
      "they",
      "them",
      "into",
      "about",
      "their",
      "where",
      "which",
      "would",
      "could",
      "should",
      "while",
      "people",
      "looking",
      "really",
      "after",
      "before",
      "every",
      "right",
      "still",
      "going",
      "company"
    ]);
    const arrA = Array.from(new Set(norm(a).filter((w) => !STOP.has(w))));
    const arrB = Array.from(new Set(norm(b).filter((w) => !STOP.has(w))));
    if (arrA.length === 0 || arrB.length === 0) return 0;
    const setB = new Set(arrB);
    let overlap = 0;
    for (const w of arrA) if (setB.has(w)) overlap += 1;
    const union = arrA.length + arrB.length - overlap;
    return Math.round((overlap / union) * 100);
  }
  const myBlob = [
    twin?.goals ?? "",
    (twin as any)?.deal_preferences ?? "",
    (twin as any)?.communication_style ?? "",
    (twin as any)?.ai_export_blob ?? ""
  ]
    .filter(Boolean)
    .join(" ");

  const directory = (allRealUsers ?? [])
    .map((p) => {
      const t = twinByUser.get(p.id) as any;
      // Headline fallback: first SUBSTANTIVE line of ai_export_blob. The
      // earlier picker accepted the first 20-200 char line — which often
      // matched "# Public footprint (https://...)", a markdown source
      // header, and showed up on contact rows as the "context". Now we
      // skip: markdown headers (#), bare URLs, key:value scaffolding
      // lines, and anything under 4 words.
      const blob = (t?.ai_export_blob || "") as string;
      const headlineFromBlob = (() => {
        if (!blob || typeof blob !== "string") return "";
        const lines = blob
          .split(/[\n\r]/)
          .map((l: string) => l.trim())
          .filter(Boolean);
        for (const l of lines) {
          if (l.length < 28 || l.length > 220) continue;
          if (l.startsWith("#")) continue; // markdown header
          if (/^https?:\/\/\S+\s*$/.test(l)) continue; // bare URL line
          if (/^[a-zA-Z_][\w\s]{0,30}:\s*https?:\/\//.test(l)) continue; // "key: https://..."
          const words = l.split(/\s+/);
          if (words.length < 4) continue;
          return l;
        }
        return "";
      })();
      // Deterministic 4-signal pair score replacing the old "every twin
      // shows 12% because the raw jaccard rounded to 2 and the floor took
      // over." See lib/pair-score.ts for the math.
      const connection_score = computePairScore(twin ?? {}, t ?? {});
      return {
        ...p,
        goals: t?.goals ?? null,
        deal_preferences: t?.deal_preferences ?? null,
        headline_fallback: headlineFromBlob,
        connection_score
      };
    })
    // Only show twins who have ACTUALLY put data into onboarding.
    // The directory previously surfaced users who had only signed up
    // (email-as-display-name, blank twin row) which read as 0% sync
    // dead-ends. Substance gate: goals > 5 chars OR ai_export_blob > 80
    // chars OR deal_preferences > 5 chars. Same threshold the find-people
    // route already uses to pick poll respondents.
    .filter((p) => {
      if (existingConvoIds.has(p.id)) return false;
      const t = twinByUser.get(p.id);
      const hasGoals = (t?.goals ?? "").trim().length > 5;
      const hasDealPrefs = (t?.deal_preferences ?? "").trim().length > 5;
      const hasBlob =
        ((t as any)?.ai_export_blob ?? "").trim().length > 80;
      return hasGoals || hasDealPrefs || hasBlob;
    })
    // Highest connection score first so the most promising matches lead.
    .sort((a, b) => b.connection_score - a.connection_score);

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

  // For Sync %: count REAL conversations + accepted agreements.
  // Previously we only counted conversations.status === "closed", but that
  // status field is rarely set even after sealed agreements + long
  // exchanges — so a user with 3 sealed deals saw "Conversations had: 0/15"
  // while "Sealed agreements: 18/18" was maxed. The fix: count any
  // conversation where the user has actually sent ≥1 message. That's the
  // strongest possible signal of "a real conversation happened".
  const { data: myMessageConvs } = await service
    .from("messages")
    .select("conversation_id")
    .eq("sender_user_id", user.id);
  const completedConvIds = Array.from(
    new Set(
      ((myMessageConvs ?? []) as Array<{ conversation_id: string }>).map(
        (m) => m.conversation_id
      )
    )
  );
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
    <AppShell>
      {/* Fire-and-forget backfill for missing summaries/scores */}
      <SummaryBackfill conversationIds={needsBackfillIds} />
      {/* Scrolls to top when arriving with ?saved=1 (post-onboarding). */}
      <ScrollTopOnSaved />

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

          {/* Premium-unlock progress — 3 completed referrals = Premium
              free. completedReferrals computed up top so the build
              doesn't trip on an async-IIFE-inside-JSX pattern. */}
          <PremiumProgressCard
            completedReferrals={completedReferrals}
          />

          {/* Invite */}
          <section>
            <BulkReachToolkit appUrl={appUrl} variant="card" />
          </section>

          {/* Always-visible feedback capture. Tag with surface so we know
              this came from the main dashboard (vs. a mobile drawer or
              the conversation page) when we read the feedback table. */}
          <QuickFeedbackWidget surface="dashboard" />
        </div>
        </div>
      </>
    </AppShell>
  );
}
