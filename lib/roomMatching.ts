import { createServiceClient } from "@/lib/supabase/server";

export type RoomMatch = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  score: number;
};

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
  if (!meTwin) return [];

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

  const scored: RoomMatch[] = [];
  for (const p of profiles ?? []) {
    const theirTwin = twinById.get(p.id);
    if (!theirTwin) continue;

    let raw = 0;
    if (
      meTwin.goals_embedding && meTwin.deal_prefs_embedding &&
      theirTwin.goals_embedding && theirTwin.deal_prefs_embedding
    ) {
      const { data } = await service.rpc("match_score", {
        my_goals: meTwin.goals_embedding,
        my_deal_prefs: meTwin.deal_prefs_embedding,
        their_goals: theirTwin.goals_embedding,
        their_deal_prefs: theirTwin.deal_prefs_embedding
      });
      raw = typeof data === "number" ? data : 0;
    }
    const score = Math.max(0, Math.min(100, Math.round((raw / 2) * 100)));

    scored.push({
      userId: p.id,
      displayName: p.display_name || "Member",
      avatarUrl: p.avatar_url,
      score
    });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

