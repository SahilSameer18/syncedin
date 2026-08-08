import { createServiceClient } from "@/lib/supabase/server";

export type RoomMatch = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  score: number;
};

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

export async function getTopMatchesInRoom(
  userId: string,
  conferenceSlug: string,
  limit = 5
): Promise<RoomMatch[]> {
  const service = createServiceClient();

  const { data: meTwin } = await service
    .from("twin_profiles")
    .select("goals, deal_preferences, goals_embedding, deal_prefs_embedding")
    .eq("user_id", userId)
    .maybeSingle();

  const { data: memberRows } = await service
    .from("conference_members")
    .select("user_id")
    .eq("conference_slug", conferenceSlug)
    .neq("user_id", userId);
  const memberIds = (memberRows ?? []).map((r: any) => r.user_id);
  if (memberIds.length === 0) return [];

  const { data: profiles } = await service
    .from("profiles")
    .select("id, display_name, avatar_url")
    .in("id", memberIds);

  const { data: twins } = await service
    .from("twin_profiles")
    .select("user_id, goals, deal_preferences, goals_embedding, deal_prefs_embedding")
    .in("user_id", memberIds);

  const twinById = new Map((twins ?? []).map((t: any) => [t.user_id, t]));

  const myGoals = meTwin?.goals ?? "";
  const myDealPrefs = meTwin?.deal_preferences ?? "";
  const myGoalTokens = tokenize(myGoals);
  const myDealTokens = tokenize(myDealPrefs);

  const scored: RoomMatch[] = [];
  for (const p of profiles ?? []) {
    const theirTwin = twinById.get(p.id);
    let finalScore = 65; // baseline

    if (
      meTwin?.goals_embedding &&
      meTwin?.deal_prefs_embedding &&
      theirTwin?.goals_embedding &&
      theirTwin?.deal_prefs_embedding
    ) {
      try {
        const { data, error } = await service.rpc("match_score", {
          my_goals: meTwin.goals_embedding,
          my_deal_prefs: meTwin.deal_prefs_embedding,
          their_goals: theirTwin.goals_embedding,
          their_deal_prefs: theirTwin.deal_prefs_embedding
        });
        if (!error && typeof data === "number") {
          finalScore = Math.max(20, Math.min(99, Math.round((data / 2) * 100)));
        }
      } catch {
        // Fall back to token overlap
      }
    } else if (theirTwin) {
      const theirGoalTokens = tokenize(theirTwin.goals ?? "");
      const theirDealTokens = tokenize(theirTwin.deal_preferences ?? "");
      const inboundFit = overlap(myGoalTokens, theirDealTokens);
      const outboundFit = overlap(theirGoalTokens, myDealTokens);
      const comp = inboundFit + outboundFit;
      finalScore = Math.max(30, Math.min(96, 50 + comp * 12));
    }

    scored.push({
      userId: p.id,
      displayName: p.display_name || "Member",
      avatarUrl: p.avatar_url,
      score: finalScore
    });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}
