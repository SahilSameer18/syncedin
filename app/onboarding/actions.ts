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
  const fields = {
    user_id: user.id,
    goals: s(formData.get("goals")),
    deal_preferences: s(formData.get("deal_preferences")),
    communication_style: s(formData.get("communication_style")),
    deal_breakers: s(formData.get("deal_breakers")),
    ai_export_blob: s(formData.get("ai_export_blob")),
    updated_at: new Date().toISOString()
  };

  await supabase
    .from("profiles")
    .update({ display_name })
    .eq("id", user.id);

  await supabase
    .from("twin_profiles")
    .upsert(fields, { onConflict: "user_id" });

  revalidatePath("/dashboard");
  revalidatePath("/onboarding");
  redirect("/dashboard");
}
