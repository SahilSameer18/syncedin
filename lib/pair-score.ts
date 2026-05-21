/**
 * Pair-sync score — how much two twins overlap, computed from their profile
 * blobs alone. Pure deterministic function: same inputs always produce the
 * same number, no LLM call, no randomness, no salting.
 *
 * Replaces the previous single-signal Jaccard with a 12% floor (which gave
 * almost everyone 12% because real unigram overlap on sparse twin profiles
 * is usually 2-8). The new score combines four signals weighted so the
 * distribution actually spreads across the 0-99 range:
 *
 *   35%  unigram overlap (stop-words filtered)
 *   20%  bigram overlap (two-word phrases — catches domain language)
 *   25%  goals-vs-goals overlap (the highest-signal field, weighted higher)
 *   20%  complementary fit (one side asks for what the other offers)
 *
 * Capped at 96 to leave room for upward movement after a real conversation
 * (post-chat the excitement_score from summarize-conversation can hit 99).
 *
 * The score is intentionally a pure function of (myBlob, theirGoals,
 * theirBlob, myGoals) — no I/O, no DB write — because it has to render
 * consistently on every contact card view without drifting between
 * refreshes. The post-chat excitement_score is a separate value stored
 * on conversations.
 */

export type TwinSnapshot = {
  goals?: string | null;
  deal_preferences?: string | null;
  communication_style?: string | null;
  comm_style?: string | null;
  deal_breakers?: string | null;
  ai_export_blob?: string | null;
};

const STOP = new Set([
  "the", "and", "for", "with", "from", "that", "this", "have", "what", "your",
  "into", "they", "them", "about", "their", "would", "could", "should", "people",
  "looking", "really", "still", "going", "want", "wants", "wanting", "need",
  "needs", "needing", "make", "makes", "making", "work", "works", "working",
  "build", "builds", "building", "built", "more", "most", "very", "much", "many",
  "some", "such", "than", "then", "when", "where", "which", "while", "after",
  "before", "around", "across", "between", "through", "without", "within",
  "over", "under", "also", "just", "like", "lots", "well", "good", "best",
  "great", "well", "thing", "things", "stuff", "high", "deep", "even", "make"
]);

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}

function bigrams(tokens: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < tokens.length - 1; i++) {
    out.push(`${tokens[i]} ${tokens[i + 1]}`);
  }
  return out;
}

function jaccard(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  let overlap = 0;
  for (const w of setA) if (setB.has(w)) overlap += 1;
  const union = setA.size + setB.size - overlap;
  return union === 0 ? 0 : overlap / union;
}

// Asks-for vs offers keyword pairs. If side A signals one half and side B
// signals the other, it's a 1.0 contribution. Symmetric: order doesn't
// matter. This catches "I'm raising" ↔ "I invest" matches that pure overlap
// misses because the words don't literally repeat.
const COMPLEMENTS: Array<[RegExp, RegExp]> = [
  [/\b(raising|seeking|need|looking)\s+(for\s+)?(funding|capital|investors|investment|seed|series)/i,
   /\b(invest|investor|angel|fund|capital|portfolio|vc|venture)/i],
  [/\b(hiring|recruit|looking\s+for\s+(a\s+)?(cmo|cto|cfo|coo|engineer|designer|operator|founder))/i,
   /\b(looking\s+for\s+(a\s+)?role|hungry|operator|seeking\s+(a\s+)?role|cmo|cto|cfo|coo)/i],
  [/\b(need\s+(a\s+)?(co.?founder|cofounder|partner))/i,
   /\b(co.?founder|cofounder|technical\s+founder|partner|join\s+a\s+team)/i],
  [/\b(distribution|growth|marketing|users|reach|audience)/i,
   /\b(distribution|growth|marketing|audience|community|influencer|creator)/i],
  [/\b(needs?\s+(a\s+)?(designer|design|ux|brand))/i,
   /\b(designer|design|ux|brand|art\s+director)/i],
  [/\b(needs?\s+(a\s+)?(developer|engineer|coder|technical))/i,
   /\b(engineer|developer|coder|technical|swe|full.?stack)/i],
  [/\b(needs?\s+(a\s+)?advisor|advisory|mentor)/i,
   /\b(advisor|mentor|coach|operator)/i],
  [/\b(podcast|press|media|journalist|writer|reporter)/i,
   /\b(podcast|press|story|interview|feature|writer|journalist)/i]
];

function complementaryFit(aBlob: string, bBlob: string): number {
  // 1.0 if at least one complementary pair fires in EITHER direction.
  // Scales linearly with how many fire — 2 hits = 0.5, 3 = 0.66, capped.
  let hits = 0;
  for (const [askR, offerR] of COMPLEMENTS) {
    const aAsks = askR.test(aBlob);
    const bOffers = offerR.test(bBlob);
    const bAsks = askR.test(bBlob);
    const aOffers = offerR.test(aBlob);
    if ((aAsks && bOffers) || (bAsks && aOffers)) hits += 1;
  }
  if (hits === 0) return 0;
  // Diminishing returns — first hit is worth most, additional ones taper.
  return Math.min(1, hits / (hits + 1.4));
}

export function computePairScore(
  me: TwinSnapshot,
  them: TwinSnapshot
): number {
  const myGoals = (me.goals ?? "").trim();
  const theirGoals = (them.goals ?? "").trim();
  const myFull = [
    me.goals ?? "",
    me.deal_preferences ?? "",
    me.communication_style ?? me.comm_style ?? "",
    me.deal_breakers ?? "",
    me.ai_export_blob ?? ""
  ].join(" ");
  const theirFull = [
    them.goals ?? "",
    them.deal_preferences ?? "",
    them.communication_style ?? them.comm_style ?? "",
    them.deal_breakers ?? "",
    them.ai_export_blob ?? ""
  ].join(" ");

  const myTokens = tokenize(myFull);
  const theirTokens = tokenize(theirFull);
  const myGoalTokens = tokenize(myGoals);
  const theirGoalTokens = tokenize(theirGoals);

  // Unigram jaccard, but amplified: real twin profiles have low jaccard
  // (the same word doesn't repeat much across distinct goals), so we
  // rescale a jaccard of 0.20 (which is meaningful) up to ~0.85. Without
  // this, every honest match scores in single digits and the rest cluster
  // at the floor.
  const uni = Math.min(1, jaccard(myTokens, theirTokens) * 4.5);

  // Bigram overlap — when both sides say "early stage" or "ai agents" or
  // "growth marketing," that's a much stronger signal than two
  // independent matches of "growth" and "marketing".
  const bi = Math.min(1, jaccard(bigrams(myTokens), bigrams(theirTokens)) * 6);

  // Goals-vs-goals — same Jaccard math but applied only to the single
  // most opinionated field. Amplified harder because goal blocks are
  // shorter.
  const goal = Math.min(1, jaccard(myGoalTokens, theirGoalTokens) * 5);

  // Complementary fit — the "you have what I need" signal.
  const comp = complementaryFit(myFull, theirFull);

  const weighted = 0.35 * uni + 0.20 * bi + 0.25 * goal + 0.20 * comp;
  // Stretch the [0, 1] interval to [3, 96] so even thin matches read as
  // a low-double-digit overlap and strong matches push into the 80s+.
  const stretched = Math.round(3 + weighted * 93);
  return Math.max(0, Math.min(96, stretched));
}
