import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { AppShell } from "../AppShell";
import { PollCreateForm } from "./PollCreateForm";

export const metadata = {
  title: "Poll · SyncedIn",
  description:
    "Ask a question to every twin on SyncedIn at once. The network synthesizes its collective answer in seconds. See how your own twin responded and correct it for better polling next time."
};

export const dynamic = "force-dynamic";

type PollRow = {
  id: string;
  question: string;
  status: string;
  synthesis_one_liner: string | null;
  synthesis: string | null;
  responses_count: number;
  overrides_count: number;
  created_at: string;
  created_by: string;
};

export default async function PollListPage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/poll");

  // Defensive: if the polls table doesn't yet exist in the live database
  // (schema migration pending), don't 500 the page. Show the manifesto +
  // empty state so the page is at least browsable.
  const service = createServiceClient();
  let polls: PollRow[] = [];
  let schemaMissing = false;
  try {
    const { data, error } = await service
      .from("polls")
      .select(
        "id, question, status, synthesis_one_liner, synthesis, responses_count, overrides_count, created_at, created_by"
      )
      .order("created_at", { ascending: false })
      .limit(60);
    if (error) {
      schemaMissing = true;
    } else {
      polls = (data ?? []) as PollRow[];
    }
  } catch {
    schemaMissing = true;
  }

  return (
    <AppShell>
      {/* MANIFESTO */}
      <section className="mt-4">
        <div className="retro-label">poll the network</div>
        <h1 className="retro-h1 text-4xl sm:text-5xl mt-3 leading-tight">
          Ask every twin on SyncedIn a question.
        </h1>
        <p
          className="mt-5 text-base sm:text-lg leading-relaxed"
          style={{ color: "var(--text-dim)", maxWidth: 760 }}
        >
          A poll on SyncedIn isn&apos;t a Twitter survey or a Google Form.
          You write one question, every twin on the platform answers it in
          their own voice based on their stored context, and the network
          synthesizes a single paragraph of what we collectively believe.
          Then you can see how your own twin responded and override it for
          higher fidelity next time.
        </p>

        <div className="mt-6 grid sm:grid-cols-3 gap-5">
          <Pillar
            k="01"
            t="One question, N answers"
            d="Every active twin on the platform generates a short first-person response shaped by their goals, voice, and context."
          />
          <Pillar
            k="02"
            t="Network-level synthesis"
            d="A second pass distills all responses into one paragraph plus a one-line headline. Outlier views surface, majority leans get quantified."
          />
          <Pillar
            k="03"
            t="Correctable by humans"
            d="See how your twin answered. If it got you wrong, edit your answer — your override carries extra weight in future synthesis."
          />
        </div>
      </section>

      {/* CREATE */}
      <section className="mt-12">
        <div className="retro-label">ask a new question</div>
        <h2 className="retro-h1 text-2xl mt-2">
          Run a poll right now.
        </h2>
        <p
          className="mt-3 text-sm leading-relaxed"
          style={{ color: "var(--text-dim)", maxWidth: 680 }}
        >
          Fan-out runs in parallel and usually finishes in 10-30 seconds
          depending on network size. You&apos;ll land on the result page when
          synthesis is complete.
        </p>
        <div className="mt-5">
          <PollCreateForm />
        </div>
      </section>

      {/* RECENT POLLS — skip this section entirely when the schema isn't
          provisioned yet; the API error surfaces inline on the create form
          and a separate "no recent polls" message would just be noise. */}
      {!schemaMissing && (
      <section className="mt-14 mb-8">
        <div className="retro-label">recent polls</div>
        <h2 className="retro-h1 text-2xl mt-2">
          What the network has been asked.
        </h2>
        {polls.length === 0 ? (
          <p
            className="mt-4 text-sm"
            style={{ color: "var(--text-dim)" }}
          >
            No polls yet. Be the first to ask the network something real.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {polls.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/poll/${p.id}`}
                  className="retro-panel retro-panel-hover block group"
                  style={{
                    padding: "16px 18px",
                    paddingRight: 44,
                    position: "relative",
                    cursor: "pointer",
                    borderColor:
                      p.status === "running"
                        ? "var(--amber)"
                        : "var(--border-bright)"
                  }}
                >
                  {/* Right-edge chevron — visible at rest so it's obvious
                      this card is tappable, not a static label. Saturates
                      on hover via the group class. */}
                  {/* Chevron sits visually inside the card; the whole
                      card is already a Link, so this is decorative. */}
                  <span
                    aria-hidden
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
                      transition: "color 120ms, border-color 120ms",
                      pointerEvents: "none"
                    }}
                  >
                    →
                  </span>
                  <div
                    className="text-xs"
                    style={{
                      color:
                        p.status === "running"
                          ? "var(--amber-bright)"
                          : "var(--text-dim)",
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      fontWeight: 700
                    }}
                  >
                    {p.status === "running"
                      ? "Synthesizing…"
                      : p.status === "ready"
                      ? `${p.responses_count} responses${
                          p.overrides_count > 0
                            ? ` · ${p.overrides_count} human-corrected`
                            : ""
                        }`
                      : p.status}
                  </div>
                  <div
                    className="mt-1 font-semibold"
                    style={{ color: "var(--text)", fontSize: 16 }}
                  >
                    {p.question}
                  </div>
                  {p.synthesis_one_liner && (
                    <div
                      className="mt-2 text-sm"
                      style={{ color: "var(--text-dim)", lineHeight: 1.5 }}
                    >
                      → {p.synthesis_one_liner}
                    </div>
                  )}
                  <div
                    className="mt-2 text-xs"
                    style={{ color: "var(--text-dim)" }}
                  >
                    {new Date(p.created_at).toLocaleString()}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      )}
    </AppShell>
  );
}

function Pillar({ k, t, d }: { k: string; t: string; d: string }) {
  return (
    <div className="retro-panel" style={{ padding: "20px 22px" }}>
      <div className="retro-amber text-xs font-bold">{k}</div>
      <div className="mt-2 font-semibold text-sm">{t}</div>
      <div
        className="mt-2 retro-dim text-xs"
        style={{ lineHeight: 1.6 }}
      >
        {d}
      </div>
    </div>
  );
}
