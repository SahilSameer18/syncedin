import Link from "next/link";
import { Wordmark } from "../Wordmark";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { FeedbackList } from "./FeedbackList";

export const metadata = {
  title: "Feedback & Requests · SyncedIn",
  description:
    "Submit a request, read what others are asking for, upvote what you want to see built. SyncedIn shipped by community signal."
};

// Don't cache — vote totals should reflect within seconds.
export const dynamic = "force-dynamic";

type Post = {
  id: string;
  user_id: string | null;
  author_name: string | null;
  title: string;
  body: string | null;
  category: string;
  created_at: string;
};

export default async function FeedbackPage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  const service = createServiceClient();

  // Load posts
  const { data: postsData } = await service
    .from("feedback_posts")
    .select(
      "id, user_id, author_name, title, body, category, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(200);
  const posts = (postsData ?? []) as Post[];

  // Load every vote, compute totals and the viewer's own vote per post.
  const { data: votesData } = posts.length
    ? await service
        .from("feedback_votes")
        .select("post_id, user_id, value")
        .in(
          "post_id",
          posts.map((p) => p.id)
        )
    : { data: [] as any[] };
  const totals = new Map<string, number>();
  const myVote = new Map<string, 1 | -1>();
  for (const v of votesData ?? []) {
    totals.set(
      v.post_id,
      (totals.get(v.post_id) ?? 0) + (v.value as number)
    );
    if (user && v.user_id === user.id) {
      myVote.set(v.post_id, v.value as 1 | -1);
    }
  }

  const ranked = posts
    .map((p) => ({
      ...p,
      score: totals.get(p.id) ?? 0,
      my_vote: myVote.get(p.id) ?? null
    }))
    .sort((a, b) => b.score - a.score || b.created_at.localeCompare(a.created_at));

  return (
    <main className="max-w-3xl mx-auto px-5 py-10">
      <div className="flex items-center justify-between">
        <Wordmark />
        <div className="flex items-center gap-4 text-sm">
          <Link href="/hypernetwork" className="retro-dim hover:text-white">
            hypernetwork
          </Link>
          <Link href="/dashboard" className="retro-dim hover:text-white">
            dashboard
          </Link>
        </div>
      </div>

      <section className="mt-10">
        <div className="retro-label">feedback &amp; requests</div>
        <h1 className="retro-h1 text-4xl mt-3 leading-tight">
          What should SyncedIn build next?
        </h1>
        <p
          className="mt-3 text-base leading-relaxed"
          style={{ color: "var(--text-dim)", maxWidth: 680 }}
        >
          Submit a feature request, a bug, an idea, anything. Read what
          others are asking for. Upvote what you want to see built. This is
          how the hypernetwork starts building itself: humans signaling the
          obvious thing to do next, the network finding consensus, the team
          shipping the top-ranked items.
        </p>
      </section>

      <FeedbackList
        signedIn={!!user}
        userId={user?.id ?? null}
        posts={ranked}
      />
    </main>
  );
}
