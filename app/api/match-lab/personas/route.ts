import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const service = createServiceClient();

    // 1. Fetch all profiles (real users + test personas)
    const { data: profiles, error: profileErr } = await service
      .from("profiles")
      .select("id, display_name, avatar_url, email, is_test_persona, created_at, last_active_at")
      .order("created_at", { ascending: false });

    if (profileErr) {
      console.error("[match-lab/personas] profiles query failed:", profileErr);
      return NextResponse.json({ personas: [] });
    }

    const userIds = (profiles ?? []).map((p: any) => p.id);
    if (userIds.length === 0) {
      return NextResponse.json({ personas: [] });
    }

    // 2. Fetch twin profiles for context & goals
    const { data: twins } = await service
      .from("twin_profiles")
      .select("user_id, goals, deal_preferences, ai_export_blob, goals_embedding")
      .in("user_id", userIds);

    const twinMap = new Map((twins as any[] ?? []).map((t) => [t.user_id, t]));

    // 3. Build persona objects & sort real members first
    const personas = (profiles ?? [])
      .map((p: any) => {
        const twin = twinMap.get(p.id);
        const goalsText = (twin?.goals ?? "").trim();
        const dealPrefsText = (twin?.deal_preferences ?? "").trim();
        const hasContent = goalsText.length > 0 || dealPrefsText.length > 0;

        return {
          id: p.id,
          name: p.display_name || p.email?.split("@")[0] || "User",
          avatarUrl: p.avatar_url || null,
          isPersona: p.is_test_persona ?? false,
          hasEmbedding: !!twin?.goals_embedding,
          hasContent,
          goalsPreview: goalsText
            ? goalsText.slice(0, 140)
            : hasContent
            ? dealPrefsText.slice(0, 140)
            : "Twin profile incomplete (needs onboarding)"
        };
      })
      .filter((p: any) => p.name)
      .sort((a, b) => {
        // Real members first, then test personas
        if (!a.isPersona && b.isPersona) return -1;
        if (a.isPersona && !b.isPersona) return 1;
        // Completed twins before incomplete twins
        if (a.hasContent && !b.hasContent) return -1;
        if (!a.hasContent && b.hasContent) return 1;
        return 0;
      });

    return NextResponse.json({ personas });
  } catch (err: any) {
    console.error("[match-lab/personas] unexpected error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to fetch personas" },
      { status: 500 }
    );
  }
}
