import { createServiceClient } from "@/lib/supabase/server";

/**
 * First-match picker (#185 — the "see-try-enjoy-invite" north star).
 *
 * The honey pot: a new user gets ZERO value until their twin produces a
 * real outcome with another real twin. Old flow: user finishes onboarding
 * → dashboard → maybe-finds-someone → maybe-starts-a-chat → maybe-
 * something-happens. That funnel leaks at every step.
 *
 * New flow: the moment onboarding saves, we auto-pick the best contextual
 * counterpart from the existing real-user pool, create a conversation,
 * kick off the twin-to-twin loop, and land the user directly in the
 * thread. Their first proposal lands within minutes, not days.
 *
 * Returns the counterpart user_id of the best match — or null when the
 * pool is empty (in which case the caller falls back to a test persona).
 */

const NO_TEST_PERSONAS = true;
const ACTIVE_WINDOW_DAYS = 60;

export type FirstMatchResult = {
  counterpartId: string;
  score: number;
  reason: string;
};

/**
 * Score how complementary two twins look. Higher = better pairing.
 *
 * We don't have embeddings yet — keyword overlap between (my goals ↔
 * their deal_preferences) is a cheap, decent proxy. Bonus weight for:
 *   - their twin being recently active (so the user lands in a thread
 *     with someone likely to engage back)
 *   - their twin being fully built (goals + deal_prefs + style all set)
 *   - their ai_export_blob existing (means they did the deep extract)
 *
 * Strictly synchronous + deterministic — no LLM calls. Future upgrade:
 * embedding cosine sim once we backfill embeddings on twin profiles.
 */
async function scorePair(
  service: ReturnType<typeof createServiceClient>,
  me: {
    goals: string;
    deal_preferences: string;
    ai_export_blob: string;
    goals_embedding: number[] | null;
    deal_prefs_embedding: number[] | null;
  },
  them: {
    goals: string;
    deal_preferences: string;
    ai_export_blob: string;
    last_active_at: string | null;
    goals_embedding: number[] | null;
    deal_prefs_embedding: number[] | null;
  }
): Promise<{ score: number; reason: string }> {
  let complementarity: number;

  // Use real embeddings when both sides have them; otherwise fall back
  // to the original keyword-overlap method — this ensures a missing
  // embedding (e.g. a fire-and-forget generation that hasn't landed yet)
  // never breaks matching entirely, it just degrades gracefully.
  if (
    me.goals_embedding && me.deal_prefs_embedding &&
    them.goals_embedding && them.deal_prefs_embedding
  ) {
    const { data, error } = await service.rpc("match_score", {
      my_goals: me.goals_embedding,
      my_deal_prefs: me.deal_prefs_embedding,
      their_goals: them.goals_embedding,
      their_deal_prefs: them.deal_prefs_embedding
    });
    complementarity = !error && typeof data === "number" ? data : 0;
  } else {
    const myGoalTokens = tokenize(me.goals);
    const myDealTokens = tokenize(me.deal_preferences);
    const theirGoalTokens = tokenize(them.goals);
    const theirDealTokens = tokenize(them.deal_preferences);
    const inboundFit = overlap(myGoalTokens, theirDealTokens);
    const outboundFit = overlap(theirGoalTokens, myDealTokens);
    complementarity = inboundFit + outboundFit;
  }

  // Everything below is UNCHANGED from the original function.
  const lastActiveMs = them.last_active_at
    ? new Date(them.last_active_at).getTime()
    : 0;
  const ageDays = lastActiveMs
    ? (Date.now() - lastActiveMs) / 86_400_000
    : 999;
  const activityBonus =
    ageDays < 14 ? 5 : ageDays < 30 ? 3 : ageDays < 60 ? 1 : 0;

  let completeness = 0;
  if (them.goals.trim().length > 40) completeness += 2;
  if (them.deal_preferences.trim().length > 40) completeness += 2;
  if (them.ai_export_blob.trim().length > 400) completeness += 3;

  const jitter = Math.random() * 0.5;
  const score = complementarity * 10 + activityBonus + completeness + jitter;

  const reason =
    complementarity > 0
      ? `Complementary goals · active ${ageDays < 1 ? "today" : `${Math.round(ageDays)}d ago`}`
      : `Active recently · twin built out`;

  return { score, reason };
}

/**
 * Strip filler, lowercase, split on non-word. Returns a set of meaningful
 * tokens (length >= 3, not a stop word).
 */
function tokenize(s: string): Set<string> {
  const stops = new Set([
    "the","and","for","with","that","this","what","want","need","into",
    "have","more","just","like","from","your","you","they","them","our",
    "are","not","but","can","will","build","make","get","got","one","two",
    "people","person","time","work","look","looking","find","really",
    "very","much","also","than","then","too","its","there","when","how",
    "who","why","where","which","about","all","any","some","one"
  ]);
  return new Set(
    (s || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 4 && !stops.has(w))
  );
}

function overlap(a: Set<string>, b: Set<string>): number {
  let n = 0;
  a.forEach((t) => {
    if (b.has(t)) n++;
  });
  return n;
}

export async function pickBestFirstMatch(
  newUserId: string
): Promise<FirstMatchResult | null> {
  const service = createServiceClient();

  // Load the new user's twin so we can compare against the pool.
  const { data: meTwin } = await service
    .from("twin_profiles")
    .select("goals, deal_preferences, ai_export_blob, goals_embedding, deal_prefs_embedding")
    .eq("user_id", newUserId)
    .maybeSingle();
  if (!meTwin) return null;
  const me = {
    goals: ((meTwin as any).goals ?? "") as string,
    deal_preferences: ((meTwin as any).deal_preferences ?? "") as string,
    ai_export_blob: ((meTwin as any).ai_export_blob ?? "") as string,
    goals_embedding: (meTwin as any).goals_embedding ?? null,
    deal_prefs_embedding: (meTwin as any).deal_prefs_embedding ?? null
  };
  // No signal to match on yet — let the caller fall back.
  if (me.goals.trim().length < 10) return null;

  // Pull real-user candidates: non-test, twin built out, recently active.
  // Cap the pool — at scale we'd switch to embedding-based ANN, but for
  // now the platform's whole real-user base fits comfortably under 500.
  const { data: candidates } = await service
    .from("profiles")
    .select("id, last_active_at, is_test_persona")
    .neq("id", newUserId)
    .eq("is_test_persona", false)
    .order("last_active_at", { ascending: false, nullsFirst: false })
    .limit(500);
  const candidateIds = (candidates ?? []).map((p: any) => p.id as string);
  if (candidateIds.length === 0) return null;

  // Twin profiles for the pool — single batch query.
  const { data: pool } = await service
    .from("twin_profiles")
    .select("user_id, goals, deal_preferences, ai_export_blob, goals_embedding, deal_prefs_embedding")
    .in("user_id", candidateIds);
  const lastActiveById = new Map<string, string | null>(
    (candidates ?? []).map(
      (p: any) => [p.id, p.last_active_at ?? null] as const
    )
  );

  // Exclude users this new user already has a conversation with (would
  // be near-impossible for a new user, but guard anyway).
  const { data: existing } = await service
    .from("conversations")
    .select("participant_a, participant_b")
    .or(`participant_a.eq.${newUserId},participant_b.eq.${newUserId}`);
  const alreadyTalking = new Set<string>();
  ((existing ?? []) as any[]).forEach((c) => {
    if (c.participant_a !== newUserId) alreadyTalking.add(c.participant_a);
    if (c.participant_b !== newUserId) alreadyTalking.add(c.participant_b);
  });

  let best: FirstMatchResult | null = null;
  for (const t of (pool ?? []) as any[]) {
    if (alreadyTalking.has(t.user_id)) continue;
    const goals = (t.goals ?? "").toString();
    // Skip empty/under-built twins — the new user's first experience
    // should be with someone who has real ammunition.
    if (goals.trim().length < 40) continue;
    const them = {
      goals,
      deal_preferences: (t.deal_preferences ?? "").toString(),
      ai_export_blob: (t.ai_export_blob ?? "").toString(),
      last_active_at: lastActiveById.get(t.user_id) ?? null,
      goals_embedding: t.goals_embedding ?? null,
      deal_prefs_embedding: t.deal_prefs_embedding ?? null
    };
    const { score, reason } = await scorePair(service, me, them);
    if (!best || score > best.score) {
      best = { counterpartId: t.user_id, score, reason };
    }
  }

  return best;
}

/**
 * Fall back to a test persona when the real-user pool is empty (early
 * adopters, fresh forks). Still better than landing on an empty
 * dashboard.
 */
export async function pickFallbackPersona(
  newUserId: string
): Promise<string | null> {
  if (NO_TEST_PERSONAS) return null;
  const service = createServiceClient();
  const { data } = await service
    .from("profiles")
    .select("id")
    .eq("is_test_persona", true)
    .neq("id", newUserId)
    .limit(1);
  return (data?.[0] as any)?.id ?? null;
}
