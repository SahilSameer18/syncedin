import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { AppShell } from "../AppShell";
import { Avatar } from "../Avatar";
import { ProposalRowBody } from "./ProposalRowBody";
import { SocialIconRow } from "../SocialIconRow";
import { socialsFromBlob } from "@/lib/social-from-blob";
import { stripGifMarkdown } from "@/lib/giphy";

/**
 * /proposals — dedicated view of every conversation's END proposal.
 * Per Jack: "be a good interface to just see where things ENDED at and
 * choosing what to do next, or change about proposal, or deny and say
 * why or what you would be open to."
 *
 * Lists every conversation the current user participates in that has a
 * non-empty `outcome_summary` (twins generated a closing proposal).
 * Each row shows: counterpart, proposed deal, age, and 4 actions:
 *   - Accept (✓): jumps to /conversations/[id] and triggers the
 *     accept-agreement flow.
 *   - Change: opens the conversation's PerConversationGoal in a fresh
 *     state so the user can revise and have the twins re-propose.
 *   - Deny with reason: posts to /api/respond-agreement with response
 *     = "rejected" + the typed reason as note.
 *   - Counter: pre-fills the conversation compose with a counter-
 *     proposal scaffold the user can edit + send.
 *
 * V1 routes "Change" + "Counter" + "Accept" to the conversation page
 * (with hash anchors so the right panel opens). "Deny w/ reason" is
 * inline since it doesn't need the full conversation context.
 */
export const dynamic = "force-dynamic";

export default async function ProposalsPage({
  searchParams
}: {
  searchParams?: { blocked?: string; owed?: string };
}) {
  const blockedPending = searchParams?.blocked === "pending";
  const owedCount = Number(searchParams?.owed) || 0;
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/proposals");

  const service = createServiceClient();

  // Pull every conversation involving this user where there's a
  // summary set (twins closed on a proposed deal). The actual column
  // is `summary` (singular), not `outcome_summary` — that was the bug
  // showing the empty state even when conversations clearly had
  // outcomes on the Messages page.
  const { data: convs } = await service
    .from("conversations")
    .select(
      "id, participant_a, participant_b, summary, counterpart_summary, status, created_at"
    )
    .or(`participant_a.eq.${user.id},participant_b.eq.${user.id}`)
    .not("summary", "is", null)
    .order("created_at", { ascending: false });

  // Strip out vacuous "no conversation occurred" / "one-sided opener
  // only" summaries — those are pollution from conversations where
  // summarize ran prematurely. New summarize-conversation route refuses
  // to write these going forward; this filter cleans up the legacy ones
  // so the proposals page stays useful.
  const VACUOUS_RE =
    /no\s+conversation\s+occurred|one[\s-]?sided\s+opener|no\s+response\s+from|no\s+outcome.*established|no\s+next\s+step\s+established/i;
  const rows = ((convs ?? []) as Array<{
    id: string;
    participant_a: string;
    participant_b: string;
    summary: string | null;
    counterpart_summary: string | null;
    status: string | null;
    created_at: string;
  }>).filter((c) => !c.summary || !VACUOUS_RE.test(c.summary));

  // Look up counterpart profiles in one batched query.
  const otherIds = Array.from(
    new Set(
      rows.map((c) =>
        c.participant_a === user.id ? c.participant_b : c.participant_a
      )
    )
  );
  let profilesById = new Map<
    string,
    {
      id: string;
      display_name: string | null;
      email: string | null;
      avatar_url: string | null;
      // Jack: "if we click their profile photo, we should take it to
      // their personal portfolio page." Need handle to build /u/<handle>.
      handle?: string | null;
      // Jack: "missing the 'active' status for some people." Pull
      // last_active_at so the proposals page can render the same
      // 'active Xh ago' pill the dashboard does.
      last_active_at?: string | null;
      linkedin_url?: string | null;
      x_url?: string | null;
      instagram_url?: string | null;
      facebook_url?: string | null;
      website_url?: string | null;
    }
  >();
  if (otherIds.length > 0) {
    // Try with social + handle + last_active columns; fall back to
    // core columns if any are missing on this DB — proposals page must
    // not 500.
    let profs: any[] = [];
    try {
      const { data } = await service
        .from("profiles")
        .select(
          "id, display_name, email, avatar_url, handle, last_active_at, linkedin_url, x_url, instagram_url, facebook_url, website_url"
        )
        .in("id", otherIds);
      profs = data ?? [];
    } catch {
      const { data } = await service
        .from("profiles")
        .select("id, display_name, email, avatar_url")
        .in("id", otherIds);
      profs = data ?? [];
    }
    profilesById = new Map((profs as any[]).map((p) => [p.id, p]));
  }

  // Pull each counterpart's twin (goals + deal_preferences + blob) so
  // socialsFromBlob can extract LinkedIn/X/IG/FB URLs the user added
  // via Sources (which lands in ai_export_blob, NOT in the explicit
  // linkedin_url etc. columns). Jack: "icon links of social media
  // things went away" — empty profile columns + no blob inference
  // meant SocialIconRow returned null.
  const twinByOtherId = new Map<
    string,
    { ai_export_blob: string | null; goals: string | null; deal_preferences: string | null }
  >();
  if (otherIds.length > 0) {
    try {
      const { data: twins } = await service
        .from("twin_profiles")
        .select("user_id, ai_export_blob, goals, deal_preferences")
        .in("user_id", otherIds);
      for (const t of (twins ?? []) as any[]) {
        twinByOtherId.set(t.user_id, {
          ai_export_blob: t.ai_export_blob ?? null,
          goals: t.goals ?? null,
          deal_preferences: t.deal_preferences ?? null
        });
      }
    } catch {
      /* silent — icons will just rely on explicit columns */
    }
  }

  // Also pull agreement_responses so we can show which proposals
  // have already been acted on (✓ accepted by me, etc).
  const convIds = rows.map((c) => c.id);
  let respsByConv = new Map<
    string,
    Array<{ user_id: string; response: string; reason: string | null }>
  >();
  if (convIds.length > 0) {
    const { data: resps } = await service
      .from("agreement_responses")
      .select("conversation_id, user_id, response, reason")
      .in("conversation_id", convIds);
    for (const r of (resps ?? []) as any[]) {
      const list = respsByConv.get(r.conversation_id) ?? [];
      list.push({
        user_id: r.user_id,
        response: r.response,
        reason: r.reason ?? null
      });
      respsByConv.set(r.conversation_id, list);
    }
  }

  // Pre-fetch the FULL agreement text for every proposal so the
  // "show the full proposal" expand is instant (no loading). One
  // batched query for all messages across all proposal conversations,
  // then per-conversation extract of the AGREEMENT: marker text.
  const fullTextByConv = new Map<string, string>();
  if (convIds.length > 0) {
    const { data: allMsgs } = await service
      .from("messages")
      .select("conversation_id, final_text, sent_at")
      .in("conversation_id", convIds)
      .order("sent_at", { ascending: false });
    // Walk newest-first; first message per conv containing the marker wins.
    const seen = new Set<string>();
    for (const m of ((allMsgs ?? []) as any[])) {
      if (seen.has(m.conversation_id)) continue;
      const text = (m.final_text ?? "").toString();
      const marker = text.match(/>>>\s*AGREEMENT:?\s*/i);
      if (marker) {
        // Scrub any GIF/image markdown the twin loop let bleed into the
        // closing AGREEMENT — GIFs belong in the transcript, not here.
        const agreement = stripGifMarkdown(
          text.slice(marker.index! + marker[0].length)
        );
        if (agreement) {
          fullTextByConv.set(m.conversation_id, agreement);
          seen.add(m.conversation_id);
        }
      }
    }
    // For convs without a marker, fall back to the conversation's summary.
    for (const c of rows) {
      if (!fullTextByConv.has(c.id) && c.summary) {
        fullTextByConv.set(c.id, stripGifMarkdown(c.summary));
      }
    }
  }

  // Same shape as ConversationsList.formatLastActive on the dashboard
  // (Jack: "missing the 'active' status for some people. If we have
  // the 'waiting on' status, we should have that for everyone").
  function formatLastActive(iso: string | null | undefined): {
    label: string;
    color: string;
  } | null {
    if (!iso) return null;
    const t = new Date(iso).getTime();
    if (!Number.isFinite(t)) return null;
    const diff = Date.now() - t;
    if (diff < 2 * 60_000) return { label: "active now", color: "var(--green)" };
    if (diff < 60 * 60_000) {
      const m = Math.max(1, Math.round(diff / 60_000));
      return { label: `active ${m}m ago`, color: "var(--green)" };
    }
    if (diff < 24 * 60 * 60_000) {
      const h = Math.max(1, Math.round(diff / (60 * 60_000)));
      return { label: `active ${h}h ago`, color: "var(--amber-bright)" };
    }
    if (diff < 7 * 24 * 60 * 60_000) {
      const d = Math.max(1, Math.round(diff / (24 * 60 * 60_000)));
      return { label: `active ${d}d ago`, color: "var(--text-dim)" };
    }
    if (diff < 30 * 24 * 60 * 60_000) {
      const w = Math.max(1, Math.round(diff / (7 * 24 * 60 * 60_000)));
      return { label: `active ${w}w ago`, color: "var(--text-dim)" };
    }
    const mo = Math.max(1, Math.round(diff / (30 * 24 * 60 * 60_000)));
    return { label: `active ${mo}mo ago`, color: "var(--text-dim)" };
  }

  function relativeAge(iso: string | null): string {
    if (!iso) return "";
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const mins = Math.round(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.round(hrs / 24);
    if (days < 14) return `${days}d ago`;
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric"
    });
  }

  return (
    <AppShell>
      <header style={{ marginBottom: 16 }}>
        <h1 className="retro-h1 text-2xl">Proposals</h1>
        <p
          className="mt-1 text-sm"
          style={{ color: "var(--text-dim)" }}
        >
          Where every twin-to-twin conversation landed. Accept the ones
          worth taking, counter the ones that are almost-right, deny the
          rest with a reason so your twin learns.
        </p>
      </header>

      {blockedPending && (
        // Dead-weight guard hit — startConversationByUserId redirects
        // here with ?blocked=pending when the user has ≥10 unanswered
        // proposals. Tell them why they can't start new convos and
        // point them at the open ones.
        <div
          className="retro-panel"
          style={{
            marginBottom: 16,
            padding: 14,
            borderColor: "var(--amber)",
            background: "rgba(245, 158, 11, 0.08)"
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--amber-bright)",
              marginBottom: 4
            }}
          >
            ⏸ network pause
          </div>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55 }}>
            You have <strong>{owedCount || "10+"}</strong> proposals waiting on
            you. Reply to a few below before starting new conversations —
            this keeps the network from filling up with dead weight.
          </p>
        </div>
      )}

      {rows.length === 0 ? (
        <div
          className="retro-panel"
          style={{
            padding: 24,
            textAlign: "center",
            color: "var(--text-dim)"
          }}
        >
          <p style={{ fontSize: 14, lineHeight: 1.55 }}>
            No proposals yet. Start a conversation from{" "}
            <Link
              href="/messages"
              style={{ color: "#1f8bff", textDecoration: "underline" }}
            >
              Messages
            </Link>{" "}
            or invite someone, and their twin&apos;s reply will land
            here once your twin closes on a proposal.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {rows.map((c) => {
            const otherId =
              c.participant_a === user.id
                ? c.participant_b
                : c.participant_a;
            const other = profilesById.get(otherId);
            const otherName =
              other?.display_name || other?.email || "Someone";
            const myResp = respsByConv
              .get(c.id)
              ?.find((r) => r.user_id === user.id);
            const theirResp = respsByConv
              .get(c.id)
              ?.find((r) => r.user_id === otherId);
            const sealed =
              myResp?.response === "accepted" &&
              theirResp?.response === "accepted";
            return (
              <article
                key={c.id}
                className="retro-panel"
                style={{
                  padding: 16,
                  display: "flex",
                  gap: 14,
                  alignItems: "flex-start"
                }}
              >
                {/* Jack: "if we click their profile photo, we should
                    take it to their personal portfolio page." */}
                {other?.handle ? (
                  <Link
                    href={`/u/${other.handle}`}
                    style={{
                      flexShrink: 0,
                      display: "block",
                      textDecoration: "none"
                    }}
                    title={`Open ${otherName}'s portfolio`}
                  >
                    <Avatar
                      id={otherId}
                      name={otherName}
                      avatarUrl={other?.avatar_url ?? null}
                      size={42}
                    />
                  </Link>
                ) : (
                  <Avatar
                    id={otherId}
                    name={otherName}
                    avatarUrl={other?.avatar_url ?? null}
                    size={42}
                  />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      flexWrap: "wrap"
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 700,
                        fontSize: 15
                      }}
                    >
                      {otherName}
                    </span>
                    <SocialIconRow
                      urls={
                        other
                          ? socialsFromBlob(other, twinByOtherId.get(otherId))
                          : null
                      }
                      size={14}
                    />
                    <span
                      style={{
                        fontSize: 11,
                        color: "var(--text-dim)",
                        letterSpacing: "0.04em"
                      }}
                    >
                      {relativeAge(c.created_at)}
                    </span>
                    {(() => {
                      // Active-status pill — parity with dashboard
                      // (Jack: "missing the active status for some
                      // people. If we have the waiting-on status, we
                      // should have that for everyone.")
                      const la = formatLastActive(other?.last_active_at);
                      if (!la) return null;
                      return (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            letterSpacing: "0.04em",
                            color: la.color,
                            border: `1px solid ${la.color}`,
                            padding: "2px 8px",
                            borderRadius: 999,
                            background: "transparent"
                          }}
                          title={
                            other?.last_active_at
                              ? `Last seen ${new Date(
                                  other.last_active_at
                                ).toLocaleString()}`
                              : undefined
                          }
                        >
                          {la.label}
                        </span>
                      );
                    })()}
                    {sealed && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          letterSpacing: "0.1em",
                          textTransform: "uppercase",
                          color: "#15803d",
                          padding: "2px 8px",
                          borderRadius: 999,
                          background: "rgba(34, 197, 94, 0.12)",
                          border: "1px solid rgba(34, 197, 94, 0.30)"
                        }}
                      >
                        ✓ sealed
                      </span>
                    )}
                    {myResp?.response === "accepted" && !sealed && (
                      <span
                        style={{
                          fontSize: 10,
                          color: "var(--text-dim)",
                          fontWeight: 700,
                          letterSpacing: "0.06em",
                          textTransform: "uppercase"
                        }}
                      >
                        waiting on {otherName.split(/\s+/)[0]}
                      </span>
                    )}
                    {myResp?.response === "rejected" && (
                      <span
                        style={{
                          fontSize: 10,
                          color: "#ef4444",
                          fontWeight: 700,
                          letterSpacing: "0.06em",
                          textTransform: "uppercase"
                        }}
                      >
                        denied
                      </span>
                    )}
                  </div>
                  {/* Counterpart summary — Jack: "missing the same info
                      we have on the dashboard, saying who this person
                      is — some good info." Pulled from
                      conversations.counterpart_summary (same field the
                      dashboard reads). Renders just above the proposal
                      so the user knows who they're saying yes/no to. */}
                  {(() => {
                    const cs = (c as any).counterpart_summary as
                      | string
                      | null
                      | undefined;
                    const csClean = stripGifMarkdown(cs);
                    if (!csClean.trim()) return null;
                    return (
                      <div
                        style={{
                          marginTop: 6,
                          fontSize: 13,
                          lineHeight: 1.5,
                          color: "var(--text-dim)"
                        }}
                      >
                        {csClean}
                      </div>
                    );
                  })()}
                  {/* Client wrapper — owns local proposal state so
                      "Change proposal" updates the displayed summary
                      + expand panel inline (no router.refresh that
                      would re-render the whole heavy server tree). */}
                  <ProposalRowBody
                    conversationId={c.id}
                    initialSummary={stripGifMarkdown(c.summary)}
                    initialFullText={
                      fullTextByConv.get(c.id) ??
                      stripGifMarkdown(c.summary) ??
                      ""
                    }
                    alreadyAccepted={myResp?.response === "accepted"}
                    alreadyRejected={myResp?.response === "rejected"}
                    sealed={sealed}
                  />
                  {/* (sealed + denied/accepted state still rendered
                      from server-side respsByConv in the header
                      above — only the action surface is lifted to
                      the client wrapper.) */}
                  {false && null}
                  {/* Even when sealed, give a way back to the full
                      messages thread for context — but as a quiet text
                      link instead of a button. */}
                  {sealed && (
                    <div style={{ marginTop: 10 }}>
                      <Link
                        href={`/conversations/${c.id}`}
                        style={{
                          fontSize: 12,
                          color: "#1f8bff",
                          fontWeight: 700,
                          textDecoration: "none"
                        }}
                      >
                        💬 open full messages →
                      </Link>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
