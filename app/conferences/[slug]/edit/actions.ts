"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function updateConference(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  if (!slug) redirect("/dashboard?error=bad_slug");

  const service = createServiceClient();
  const { data: conf } = await service
    .from("conferences")
    .select("owner_user_id")
    .eq("slug", slug)
    .maybeSingle();
  if (!conf || conf.owner_user_id !== user.id) {
    redirect(`/conferences/${slug}?error=not_owner`);
  }

  const patch = {
    name: String(formData.get("name") ?? "").trim() || "Unnamed conference",
    description:
      String(formData.get("description") ?? "").trim() || null,
    starts_at: String(formData.get("starts_at") ?? "").trim() || null,
    ends_at: String(formData.get("ends_at") ?? "").trim() || null,
    city: String(formData.get("city") ?? "").trim() || null
  };

  await service.from("conferences").update(patch).eq("slug", slug);

  revalidatePath(`/conferences/${slug}`);
  redirect(`/conferences/${slug}?saved=1`);
}

export async function deleteConference(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  if (!slug) redirect("/dashboard");

  const service = createServiceClient();
  const { data: conf } = await service
    .from("conferences")
    .select("owner_user_id")
    .eq("slug", slug)
    .maybeSingle();
  if (!conf || conf.owner_user_id !== user.id) {
    redirect(`/conferences/${slug}?error=not_owner`);
  }

  // Members cascade via FK on delete.
  await service.from("conferences").delete().eq("slug", slug);

  revalidatePath("/dashboard");
  redirect("/dashboard?deleted=conference");
}
