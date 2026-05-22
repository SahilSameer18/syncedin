import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { AppShell } from "../AppShell";
import { Avatar } from "../Avatar";
import { ExpandProposal } from "./ExpandProposal";

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

export default async function ProposalsPage() {
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
      "id, participant_a, participant_b, summary, status, created_at"
    )
    .or(`participant_a.eq.${user.id},participant_b.eq.${user.id}`)
    .not("summary", "is", null)
    .order("created_at", { ascending: false });

  const rows = (convs ?? []) as Array<{
    id: string;
    participant_a: string;
    participant_b: string;
    summary: string | null;
    status: string | null;
    created_at: string;
  }>;

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
    }
  >();
  if (otherIds.length > 0) {
    const { data: profs } = await service
      .from("profiles")
      .select("id, display_name, email, avatar_url")
      .in("id", otherIds);
    profilesById = new Map(
      ((profs ?? []) as any[]).map((p) => [p.id, p])
    );
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
                <Avatar
                  id={otherId}
                  name={otherName}
                  avatarUrl={other?.avatar_url ?? null}
                  size={42}
                />
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
                    <span
                      style={{
                        fontSize: 11,
                        color: "var(--text-dim)",
                        letterSpacing: "0.04em"
                      }}
                    >
                      {relativeAge(c.created_at)}
                    </span>
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
                  <p
                    style={{
                      marginTop: 8,
                      fontSize: 14,
                      lineHeight: 1.5,
                      color: "var(--text)",
                      whiteSpace: "pre-wrap"
                    }}
                  >
                    {c.summary}
                  </p>
                  {/* Expand → reveals the full agreement text (vs. the
                      short summary headline above). Lazy-fetched on
                      first click via /api/conversations/<id>/agreement-text. */}
                  <ExpandProposal conversationId={c.id} />
                  {/* Primary "open full conversation" link — most direct
                      path back to the full messages thread for context
                      before deciding accept/change/counter/deny. */}
                  <div style={{ marginTop: 12 }}>
                    <Link
                      href={`/conversations/${c.id}`}
                      className="retro-btn retro-btn-primary text-xs"
                      style={{
                        padding: "8px 14px",
                        fontWeight: 700,
                        textDecoration: "none",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6
                      }}
                    >
                      💬 open full messages →
                    </Link>
                  </div>
                  {!sealed && (
                    <div
                      style={{
                        marginTop: 10,
                        display: "flex",
                        gap: 8,
                        flexWrap: "wrap"
                      }}
                    >
                      {myResp?.response !== "accepted" && (
                        <Link
                          href={`/conversations/${c.id}#agreement`}
                          className="retro-btn retro-btn-primary text-xs"
                          style={{
                            padding: "6px 12px",
                            fontWeight: 700,
                            textDecoration: "none"
                          }}
                        >
                          ✓ accept
                        </Link>
                      )}
                      <Link
                        href={`/conversations/${c.id}?action=change`}
                        className="retro-btn text-xs"
                        style={{
                          padding: "6px 12px",
                          fontWeight: 700,
                          textDecoration: "none"
                        }}
                      >
                        ✎ change proposal
                      </Link>
                      <Link
                        href={`/conversations/${c.id}?action=counter`}
                        className="retro-btn text-xs"
                        style={{
                          padding: "6px 12px",
                          fontWeight: 700,
                          textDecoration: "none"
                        }}
                      >
                        ↺ counter
                      </Link>
                      {myResp?.response !== "rejected" && (
                        <Link
                          href={`/conversations/${c.id}?action=deny`}
                          className="retro-btn text-xs"
                          style={{
                            padding: "6px 12px",
                            fontWeight: 700,
                            color: "#ef4444",
                            borderColor: "rgba(239, 68, 68, 0.35)",
                            textDecoration: "none"
                          }}
                        >
                          ✕ deny with reason
                        </Link>
                      )}
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
