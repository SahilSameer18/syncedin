import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Auto-save the onboarding wizard draft. Fires on a debounce as the user
 * types so context is never lost on refresh / back-button.
 *
 * Saves to the same row as the final commit so the wizard can hydrate
 * itself by reading twin_profiles + profile on next visit.
 */
export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: {
    display_name?: string;
    avatar_url?: string;
    goals?: string;
    deal_preferences?: string;
    communication_style?: string;
    deal_breakers?: string;
    ai_export_blob?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const clean = (s?: string) =>
    s && s.trim().length > 0 ? s : null;

  // Profile fields (display_name, avatar_url)
  const profileUpdate: Record<string, string | null> = {};
  if (body.display_name !== undefined)
    profileUpdate.display_name = clean(body.display_name);
  if (body.avatar_url !== undefined)
    profileUpdate.avatar_url = clean(body.avatar_url);
  if (Object.keys(profileUpdate).length > 0) {
    await supabase.from("profiles").update(profileUpdate).eq("id", user.id);
  }

  // Twin profile fields
  await supabase.from("twin_profiles").upsert(
    {
      user_id: user.id,
      goals: clean(body.goals),
      deal_preferences: clean(body.deal_preferences),
      communication_style: clean(body.communication_style),
      deal_breakers: clean(body.deal_breakers),
      ai_export_blob: clean(body.ai_export_blob),
      updated_at: new Date().toISOString()
    },
    { onConflict: "user_id" }
  );

  return NextResponse.json({ ok: true });
}
