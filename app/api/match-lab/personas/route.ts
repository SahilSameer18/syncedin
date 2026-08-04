import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const service = createServiceClient();

    const { data: twins, error: twinErr } = await service
      .from("twin_profiles")
      .select("user_id, goals, goals_embedding")
      .not("goals", "is", null);

    if (twinErr) {
      console.error("[match-lab/personas] twin_profiles query failed:", twinErr);
      return NextResponse.json({ personas: [] });
    }

    const userIds = (twins ?? []).map((t: any) => t.user_id);
    if (userIds.length === 0) {
      return NextResponse.json({ personas: [] });
    }

    const { data: profiles, error: profileErr } = await service
      .from("profiles")
      .select("id, display_name, avatar_url, email, is_test_persona")
      .in("id", userIds);

    if (profileErr) {
      console.error("[match-lab/personas] profiles query failed:", profileErr);
      return NextResponse.json({ personas: [] });
    }

    const twinMap = new Map((twins as any[]).map((t) => [t.user_id, t]));

    const personas = (profiles ?? [])
      .map((p: any) => {
        const twin = twinMap.get(p.id);
        return {
          id: p.id,
          name: p.display_name || p.email?.split("@")[0] || "User",
          avatarUrl: p.avatar_url || null,
          isPersona: p.is_test_persona ?? false,
          hasEmbedding: !!twin?.goals_embedding,
          goalsPreview: (twin?.goals ?? "").slice(0, 140)
        };
      })
      .filter((p: any) => p.name);

    return NextResponse.json({ personas });
  } catch (err: any) {
    console.error("[match-lab/personas] unexpected error:", err);
    return NextResponse.json({ error: err?.message || "Failed to fetch personas" }, { status: 500 });
  }
}
