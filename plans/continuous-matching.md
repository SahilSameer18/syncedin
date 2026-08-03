Continuous Matching (built on real, existing code)
The two fixes combined, in order

Fix 1 (already planned): Replace keyword-overlap scoring with real embeddings
Fix 2 (this plan): Make matching re-run periodically for everyone, not just once at signup

The exact problem, precisely stated

notifyNewMatch() already does real, solid work — it correctly creates conversations and notifies existing users the moment someone new signs up. But it only runs once, triggered by that one signup event. Two people who were both already on the platform before this matching logic mattered to them — say, one updates their goals six months later — never get automatically re-checked against each other. Nothing re-scans the whole existing user base against itself over time.

The Fix — Full Plan
1. Extract the reusable "check one pair" logic

Right now, the pair-checking + conversation-creation + email logic lives inside notifyNewMatch's loop. Pull it out into its own reusable function in lib/notify.ts:

ts
export async function checkAndNotifyPair(userIdA: string, userIdB: string): Promise<boolean> {
  // same scoring, threshold-check, consent-check, conversation-creation,
  // and email logic already proven inside notifyNewMatch — just usable
  // for ANY two users, not only "new user vs existing"
}

notifyNewMatch itself gets simplified to just loop through candidates and call this shared function — no behavior change for the existing signup flow, just cleaner, reusable code.

2. New table — prevents repeat notifications

Without this, the same pair could get notified every single day forever. Need to remember who's already been checked:

sql
create table if not exists public.match_checks (
  user_a uuid not null references public.profiles(id) on delete cascade,
  user_b uuid not null references public.profiles(id) on delete cascade,
  checked_at timestamptz not null default now(),
  primary key (user_a, user_b)
);

(Always store with user_a < user_b ordering, so each pair only ever has one row, checked once, ever — re-checking only makes sense if someone meaningfully updates their profile, which is a nice future refinement, not needed for v1.)

3. New daily cron job

app/api/cron/rescan-matches/route.ts — same proven security pattern as their existing weekly-digest (secret key check, timing-safe comparison), same vercel.json scheduling approach, just running daily instead of weekly:

ts
// 1. Get all active users with a completed twin profile
// 2. For each pair not already in match_checks and without an
//    existing conversation, call checkAndNotifyPair()
// 3. Insert a row into match_checks either way, so it's never
//    re-checked again unnecessarily
4. Handling scale (mention this, ties nicely into the embedding upgrade)

Checking every possible pair (n × n) is fine at their current size (roughly a few thousand comparisons at ~100 users), but won't scale forever. Since we're already using pgvector for the embedding upgrade, there's a natural, elegant fix: instead of brute-force comparing everyone to everyone, use pgvector's built-in nearest-neighbor search to only check each user against their most-likely candidates first (say, top 50 closest by embedding), not the entire user base. This is a real, standard scaling technique — worth explaining even if not fully built out, shows you're thinking ahead.

5. vercel.json update
json
{
  "crons": [
    { "path": "/api/cron/weekly-digest", "schedule": "0 14 * * 1" },
    { "path": "/api/cron/rescan-matches", "schedule": "0 8 * * *" }
  ]
}
Combined with the embedding fix (from before)

checkAndNotifyPair calls the same computePairScore function — which, per the earlier plan, now uses real embeddings instead of keyword overlap. So both fixes work together automatically: better-quality matching (embeddings), running continuously (daily cron), not just once.

What stays exactly the same, unchanged
notifyNewMatch's existing behavior for brand-new signups — unchanged, just internally reuses the extracted shared function
Every existing consent/threshold/preference check (on_new_match, match_threshold) — fully respected in the new cron too, not bypassed
Demo plan for the interview

Show two existing seeded test users who don't yet have a conversation. Manually trigger the new cron endpoint live. Show a real conversation and notification getting created between them in real time — proving the "continuous" part actually works, on screen, not just described.

