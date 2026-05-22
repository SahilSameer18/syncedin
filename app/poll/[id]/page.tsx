import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { AppShell } from "../../AppShell";
import { ClientDate } from "../../ClientDate";
import { OverrideRow } from "./OverrideRow";
import { ReSynthesizeButton } from "./ReSynthesizeButton";
import { PollMissingTwinsButton } from "./PollMissingTwinsButton";

export const dynamic = "force-dynamic";

type PollRow = {
  id: string;
  question: string;
  context: string | null;
  status: string;
  synthesis: string | null;
  synthesis_one_liner: string | null;
  responses_count: number;
  overrides_count: number;
  created_at: string;
  synthesized_at: string | null;
  created_by: string;
};

type ResponseRow = {
  id: string;
  poll_id: string;
  twin_user_id: string;
  twin_response: string;
  human_override: string | null;
  was_overridden: boolean;
  generated_at: string;
  overridden_at: string | null;
};

type ProfileRow = {
  id: string;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
};

export default async function PollDetailPage({
  params
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/poll/${params.id}`);

  const service = createServiceClient();
  const { data: poll } = await service
    .from("polls")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();
  if (!poll) notFound();
  const p = poll as PollRow;

  const { data: responsesData } = await service
    .from("poll_responses")
    .select(
      "id, poll_id, twin_user_id, twin_response, human_override, was_overridden, generated_at, overridden_at"
    )
    .eq("poll_id", params.id);
  const responses = (responsesData ?? []) as ResponseRow[];

  const userIds = responses.map((r) => r.twin_user_id);
  const { data: profilesData } = userIds.length
    ? await service
        .from("profiles")
        .select("id, display_name, email, avatar_url")
        .in("id", userIds)
    : { data: [] as ProfileRow[] };
  const profiles = ((profilesData ?? []) as ProfileRow[]).reduce<
    Record<string, ProfileRow>
  >((acc, pr) => {
    acc[pr.id] = pr;
    return acc;
  }, {});

  const myResponse = responses.find((r) => r.twin_user_id === user.id) ?? null;
  const networkResponses = responses
    .filter((r) => r.twin_user_id !== user.id)
    .sort((a, b) =>
      a.was_overridden === b.was_overridden ? 0 : a.was_overridden ? -1 : 1
    );

  // Count twins on the platform who have NOT yet answered this poll —
  // these are the ones the retroactive "poll new twins" button will pick
  // up. Same signal filter as /api/polls/create (goals or ai_export_blob
  // long enough to give a real answer).
  const answeredIds = new Set(responses.map((r) => r.twin_user_id));
  const { data: allTwins } = await service
    .from("twin_profiles")
    .select("user_id, goals, ai_export_blob")
    .limit(400);
  const eligibleTwins = ((allTwins as any[]) ?? []).filter(
    (t) =>
      (t.goals && t.goals.trim().length > 5) ||
      (t.ai_export_blob && t.ai_export_blob.trim().length > 40)
  );
  const missingTwinsCount = eligibleTwins.filter(
    (t) => !answeredIds.has(t.user_id)
  ).length;

  return (
    <AppShell>
      <section className="mt-4">
        <Link
          href="/poll"
          className="retro-dim text-xs"
          style={{ color: "var(--text-dim)" }}
        >
          ← back to polls
        </Link>
        <div className="retro-label mt-3">poll · {p.status}</div>
        <h1 className="retro-h1 text-3xl sm:text-4xl mt-2 leading-tight">
          {p.question}
        </h1>
        {p.context && (
          <p
            className="mt-3 text-sm"
            style={{ color: "var(--text-dim)", maxWidth: 720 }}
          >
            {p.context}
          </p>
        )}
        <div
          className="mt-3 text-xs"
          style={{ color: "var(--text-dim)" }}
        >
          {p.responses_count} twin responses
          {p.overrides_count > 0
            ? ` · ${p.overrides_count} human-corrected`
            : ""}{" "}
          · created <ClientDate value={p.created_at} />
        </div>
      </section>

      {/* SYNTHESIS */}
      <section
        className="mt-8 retro-panel"
        style={{
          padding: 24,
          borderColor: "var(--amber)",
          background:
            "radial-gradient(800px 500px at 50% 0%, rgba(255,184,77,0.06), transparent 60%), var(--panel-solid)"
        }}
      >
        <div
          className="retro-label"
          style={{ color: "var(--amber-bright)" }}
        >
          network synthesis
        </div>
        {p.status === "running" ? (
          <div
            className="mt-3 text-base"
            style={{ color: "var(--text-dim)" }}
          >
            Synthesizing… every twin is answering in parallel. This page will
            update once the synthesis is ready.
          </div>
        ) : (
          <>
            {p.synthesis_one_liner && (
              <h2
                className="retro-h1 text-2xl mt-2"
                style={{ lineHeight: 1.35 }}
              >
                → {p.synthesis_one_liner}
              </h2>
            )}
            {p.synthesis && (
              <p
                className="mt-4 text-base leading-relaxed"
                style={{ color: "var(--text)", maxWidth: 760 }}
              >
                {p.synthesis}
              </p>
            )}
            <ReSynthesizeButton pollId={p.id} />
            <PollMissingTwinsButton
              pollId={p.id}
              pendingCount={missingTwinsCount}
            />
          </>
        )}
      </section>

      {/* YOUR TWIN — override surface */}
      {myResponse && (
        <section className="mt-10">
          <div className="retro-label">your twin&apos;s answer</div>
          <h2 className="retro-h1 text-2xl mt-2">
            How you came across in this poll.
          </h2>
          <p
            className="mt-2 text-sm"
            style={{ color: "var(--text-dim)", maxWidth: 720 }}
          >
            This is what the network heard from you. If it&apos;s not
            actually what you&apos;d say, edit it. Your correction carries
            extra weight in the re-synthesis and trains the platform&apos;s
            sense of you.
          </p>
          <div className="mt-4">
            <OverrideRow response={myResponse} pollId={p.id} isSelf={true} />
          </div>
        </section>
      )}

      {/* NETWORK — every other twin */}
      <section className="mt-12 mb-8">
        <div className="retro-label">every twin&apos;s answer</div>
        <h2 className="retro-h1 text-2xl mt-2">
          What the rest of the network said.
        </h2>
        <p
          className="mt-2 text-sm"
          style={{ color: "var(--text-dim)" }}
        >
          {networkResponses.length} responses · human-corrected ones rise to
          the top.
        </p>
        <ul className="mt-5 space-y-3">
          {networkResponses.map((r) => {
            const pr = profiles[r.twin_user_id];
            const name =
              pr?.display_name || pr?.email?.split("@")[0] || "Someone";
            return (
              <li
                key={r.id}
                className="retro-panel"
                style={{
                  padding: 16,
                  borderColor: r.was_overridden
                    ? "var(--amber)"
                    : "var(--border)"
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      background: "var(--panel-2)",
                      border: "1px solid var(--border-bright)",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12,
                      fontWeight: 700,
                      color: "var(--text)",
                      backgroundImage: pr?.avatar_url
                        ? `url(${pr.avatar_url})`
                        : undefined,
                      backgroundSize: "cover",
                      backgroundPosition: "center"
                    }}
                  >
                    {pr?.avatar_url ? "" : name.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="font-semibold text-sm">
                    {name}
                    {r.was_overridden && (
                      <span
                        className="ml-2 text-xs"
                        style={{ color: "var(--amber-bright)" }}
                      >
                        ✓ human-corrected
                      </span>
                    )}
                  </div>
                </div>
                <div
                  className="mt-2 text-sm"
                  style={{
                    color: "var(--text)",
                    lineHeight: 1.5,
                    whiteSpace: "pre-wrap"
                  }}
                >
                  {r.was_overridden && r.human_override
                    ? r.human_override
                    : r.twin_response}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </AppShell>
  );
}
