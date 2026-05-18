"use server";

import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function createConference(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/conferences/new");

  const name = String(formData.get("name") ?? "").trim();
  let slug = slugify(String(formData.get("slug") ?? "").trim());
  if (!name) redirect("/conferences/new?error=missing_name");
  if (!slug) slug = slugify(name);
  if (!slug) redirect("/conferences/new?error=bad_slug");

  const service = createServiceClient();

  // Ensure uniqueness with a short random suffix on collision.
  let candidate = slug;
  for (let i = 0; i < 4; i++) {
    const { data: existing } = await service
      .from("conferences")
      .select("slug")
      .eq("slug", candidate)
      .maybeSingle();
    if (!existing) break;
    candidate = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
  }
  slug = candidate;

  const row = {
    slug,
    name,
    description: String(formData.get("description") ?? "").trim() || null,
    owner_user_id: user.id,
    starts_at: String(formData.get("starts_at") ?? "").trim() || null,
    ends_at: String(formData.get("ends_at") ?? "").trim() || null,
    city: String(formData.get("city") ?? "").trim() || null
  };

  const { error: insErr } = await service.from("conferences").insert(row);
  if (insErr) {
    console.error("[conferences/new] insert failed", insErr);
    redirect("/conferences/new?error=create_failed");
  }

  // Owner is automatically a member.
  await service
    .from("conference_members")
    .insert({ conference_slug: slug, user_id: user.id });

  redirect(`/conferences/${slug}?created=1`);
}
