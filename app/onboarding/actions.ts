"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function s(v: FormDataEntryValue | null): string | null {
  if (v === null) return null;
  const t = String(v).trim();
  return t.length > 0 ? t : null;
}

export async function saveTwin(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const display_name = s(formData.get("display_name"));
  const avatar_url = s(formData.get("avatar_url"));
  const fields = {
    user_id: user.id,
    goals: s(formData.get("goals")),
    deal_preferences: s(formData.get("deal_preferences")),
    communication_style: s(formData.get("communication_style")),
    deal_breakers: s(formData.get("deal_breakers")),
    ai_export_blob: s(formData.get("ai_export_blob")),
    hometown: s(formData.get("hometown")),
    current_city: s(formData.get("current_city")),
    updated_at: new Date().toISOString()
  };

  // Build a single profile update — only set the columns the user touched.
  const profileUpdate: Record<string, string | null> = {};
  if (display_name !== null) profileUpdate.display_name = display_name;
  if (avatar_url !== null) profileUpdate.avatar_url = avatar_url;
  if (Object.keys(profileUpdate).length > 0) {
    await supabase
      .from("profiles")
      .update(profileUpdate)
      .eq("id", user.id);
  }

  await supabase
    .from("twin_profiles")
    .upsert(fields, { onConflict: "user_id" });

  revalidatePath("/dashboard");
  revalidatePath("/onboarding");
  // ?saved=1 lets the dashboard scroll to top + show a confirmation.
  // Without it, browser scroll-restoration kept the page anchored to
  // wherever the user last was, landing them at the bottom.
  redirect("/dashboard?saved=1");
}
