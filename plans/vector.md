Final Plan: Real Semantic Matching
How to explain the problem (say this first, simply)

"Right now, when SyncdIn decides if two people are a good match, it just counts how many of the same words they both used. Their own code even says this is a placeholder. That means two people can be a perfect real match — like a founder needing a technical co-founder, and an engineer wanting to join an early startup — and the system might miss it completely, just because they phrased it differently. I built the real version: instead of counting words, the AI actually understands what each person means, and matches on meaning, not wording."

How it works — Frontend (what a user sees)
Nothing changes visually in most places — this is an under-the-hood upgrade
The one visible change: on the dashboard's match/search results, scores will simply be more accurate — a small note like "Smarter matching, powered by AI" can be added near the score, so it's not invisible work
For the demo: a simple before/after comparison screen, showing the same two people scored the old way vs. the new way
How it works — Backend (the real engineering)
When someone saves their twin profile, their goals text and deal preferences text each get converted into a vector (a list of numbers capturing meaning) — kept as two separate vectors, not merged
These vectors are stored in the database using pgvector, a real Postgres extension built for this
When comparing two people, the database itself calculates how close their vectors are — my goals vector compared to their deal-preferences vector, and vice versa — same complementary-match logic their code already correctly uses, just powered by real understanding instead of word-counting
Full Technical Plan
1. Enable vector storage
sql
create extension if not exists vector;

alter table public.twin_profiles
  add column if not exists goals_embedding vector(768),
  add column if not exists deal_prefs_embedding vector(768);

(Two separate columns — one for goals, one for deal preferences, matching the fix we already agreed on: never merge them into one.)

2. New file: lib/embeddings.ts
ts
export async function getEmbedding(text: string): Promise<number[]> {
  const response = await gemini.models.embedContent({
    model: "gemini-embedding-001",
    contents: text,
    config: { outputDimensionality: 768 }
  });
  return response.embeddings[0].values;
}
3. Generate embeddings when a twin profile is saved

In the existing onboarding/twin-save action: after saving goals and deal_preferences as text, also call getEmbedding() on each separately, and save the two resulting vectors into the new columns.

4. The correct similarity query (this is the part I initially had wrong)
sql
create or replace function match_score(
  my_goals vector(768),
  my_deal_prefs vector(768),
  their_goals vector(768),
  their_deal_prefs vector(768)
) returns float
language sql as $$
  select
    (1 - (my_goals <=> their_deal_prefs)) +
    (1 - (their_goals <=> my_deal_prefs))
$$;

Note: <=> is cosine distance (lower = more similar), so 1 - (a <=> b) correctly converts it to cosine similarity (higher = more similar) — this is a real, commonly-made mistake I made sure to get right here.

5. Upgrade lib/matchmaking.ts

Replace the scorePair function's keyword-overlap math with a call to this new database function — same overall structure (still combines with activity bonus, completeness bonus), just the core complementarity number now comes from real embeddings instead of counting shared words.

6. Backfill script

A one-time script looping through existing twin_profiles rows missing embeddings, generating and saving them — so current users aren't left behind.

7. Performance, for scale (mention this if asked — shows depth)

Add an HNSW index for fast lookups as the user base grows:

sql
create index on public.twin_profiles using hnsw (goals_embedding vector_cosine_ops);

Not urgent at their current small scale, but worth knowing and mentioning — shows you're thinking beyond just "does it work," to "will it still work at scale."

