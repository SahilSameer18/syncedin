"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Post = {
  id: string;
  user_id: string | null;
  author_name: string | null;
  title: string;
  body: string | null;
  category: string;
  created_at: string;
  score: number;
  my_vote: 1 | -1 | null;
};

const CATEGORIES = [
  { key: "idea", label: "Idea", color: "#3a4dff" },
  { key: "feature", label: "Feature", color: "#5ee5b2" },
  { key: "bug", label: "Bug", color: "#ff6b6b" },
  { key: "other", label: "Other", color: "#a060ff" }
];

export function FeedbackList({
  signedIn,
  userId,
  posts
}: {
  signedIn: boolean;
  userId: string | null;
  posts: Post[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("idea");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voting, setVoting] = useState<string | null>(null);
  // Optimistic vote state
  const [optimistic, setOptimistic] = useState<
    Record<string, { score: number; my_vote: 1 | -1 | null }>
  >({});

  function viewOf(p: Post) {
    const o = optimistic[p.id];
    return o
      ? { score: p.score + (o.score - (p.score + (o.score - p.score))), my_vote: o.my_vote }
      : { score: p.score, my_vote: p.my_vote };
  }

  async function submit() {
    if (!title.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const r = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: title.trim(), body: body.trim(), category })
      });
      const j = await r.json();
      if (j.error) {
        setError(j.detail || j.error);
        return;
      }
      setTitle("");
      setBody("");
      setCategory("idea");
      router.refresh();
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setSubmitting(false);
    }
  }

  async function vote(post: Post, value: 1 | -1) {
    if (!signedIn) {
      window.location.href = "/login";
      return;
    }
    setVoting(post.id);
    // Optimistic update
    const prevMy = post.my_vote;
    let nextMy: 1 | -1 | null;
    let delta = 0;
    if (prevMy === value) {
      // toggle off
      nextMy = null;
      delta = -value;
    } else if (prevMy === null) {
      nextMy = value;
      delta = value;
    } else {
      nextMy = value;
      delta = 2 * value; // flip
    }
    setOptimistic((o) => ({
      ...o,
      [post.id]: { score: post.score + delta, my_vote: nextMy }
    }));
    try {
      await fetch("/api/feedback/vote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ post_id: post.id, value })
      });
      router.refresh();
    } catch {
      // Roll back optimistic on error
      setOptimistic((o) => {
        const { [post.id]: _, ...rest } = o;
        return rest;
      });
    } finally {
      setVoting(null);
    }
  }

  return (
    <>
      {/* Submission form */}
      <section className="mt-8 retro-panel retro-shadow p-5">
        <div className="retro-label">submit a request</div>
        {!signedIn ? (
          <p
            className="text-sm mt-2"
            style={{ color: "var(--text-dim)" }}
          >
            <a
              href="/login"
              className="underline"
              style={{ color: "var(--amber-bright)" }}
            >
              Sign in
            </a>{" "}
            to post a request or vote.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 200))}
              placeholder="A short title — what should we build?"
              className="retro-input"
              maxLength={200}
            />
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value.slice(0, 4000))}
              rows={3}
              placeholder="Optional: any details, why this matters, who it's for."
              className="retro-input"
              maxLength={4000}
            />
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex gap-1.5">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setCategory(c.key)}
                    className="text-xs"
                    style={{
                      padding: "5px 10px",
                      borderRadius: 999,
                      border: `1.5px solid ${
                        category === c.key ? c.color : "var(--border-bright)"
                      }`,
                      background:
                        category === c.key
                          ? `${c.color}22`
                          : "transparent",
                      color: category === c.key ? c.color : "var(--text-dim)",
                      fontWeight: 700,
                      cursor: "pointer"
                    }}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={submit}
                disabled={submitting || !title.trim()}
                className="retro-btn retro-btn-primary ml-auto"
              >
                {submitting ? "posting…" : "+ post request"}
              </button>
            </div>
            {error && (
              <div
                className="text-xs p-2 retro-panel"
                style={{ borderColor: "var(--red)", color: "var(--red)" }}
              >
                {error}
              </div>
            )}
          </div>
        )}
      </section>

      {/* List */}
      <section className="mt-8">
        <div
          className="retro-label flex items-baseline justify-between"
        >
          <span>community requests · sorted by upvotes</span>
          <span
            className="text-xs font-normal"
            style={{ color: "var(--text-dim)", letterSpacing: 0 }}
          >
            {posts.length} total
          </span>
        </div>

        {posts.length === 0 ? (
          <p
            className="mt-5 text-sm"
            style={{ color: "var(--text-dim)" }}
          >
            No requests yet. Be the first.
          </p>
        ) : (
          <ul className="mt-5 space-y-3">
            {posts.map((p) => {
              const view = viewOf(p);
              const cat =
                CATEGORIES.find((c) => c.key === p.category) ?? CATEGORIES[0];
              return (
                <li
                  key={p.id}
                  className="retro-panel p-4 flex items-stretch gap-4"
                >
                  {/* Vote column */}
                  <div className="flex flex-col items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => vote(p, 1)}
                      disabled={voting === p.id}
                      aria-label="upvote"
                      style={{
                        background: "transparent",
                        border: 0,
                        padding: 0,
                        cursor: "pointer",
                        color:
                          view.my_vote === 1
                            ? "var(--amber-bright)"
                            : "var(--text-dim)",
                        fontSize: 22,
                        lineHeight: 1
                      }}
                    >
                      ▲
                    </button>
                    <div
                      style={{
                        fontWeight: 800,
                        fontSize: 16,
                        fontFamily:
                          '"IBM Plex Mono", ui-monospace, monospace',
                        color:
                          view.score > 0
                            ? "var(--text)"
                            : view.score < 0
                            ? "var(--red)"
                            : "var(--text-dim)"
                      }}
                    >
                      {view.score > 0 ? `+${view.score}` : view.score}
                    </div>
                    <button
                      type="button"
                      onClick={() => vote(p, -1)}
                      disabled={voting === p.id}
                      aria-label="downvote"
                      style={{
                        background: "transparent",
                        border: 0,
                        padding: 0,
                        cursor: "pointer",
                        color:
                          view.my_vote === -1
                            ? "var(--red)"
                            : "var(--text-dim)",
                        fontSize: 22,
                        lineHeight: 1
                      }}
                    >
                      ▼
                    </button>
                  </div>

                  {/* Post body */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="text-[10px]"
                        style={{
                          padding: "2px 8px",
                          borderRadius: 4,
                          background: `${cat.color}22`,
                          color: cat.color,
                          fontWeight: 700,
                          letterSpacing: "0.08em",
                          textTransform: "uppercase"
                        }}
                      >
                        {cat.label}
                      </span>
                      <span
                        className="text-[11px]"
                        style={{ color: "var(--text-dim)" }}
                      >
                        {p.author_name || "anon"} ·{" "}
                        {new Date(p.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div
                      className="font-semibold text-base mt-1.5"
                      style={{ color: "var(--text)" }}
                    >
                      {p.title}
                    </div>
                    {p.body && (
                      <div
                        className="text-sm mt-1.5 whitespace-pre-wrap"
                        style={{ color: "var(--text-dim)" }}
                      >
                        {p.body}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
