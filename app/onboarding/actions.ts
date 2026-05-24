"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { slugifyHandle } from "@/lib/handle";
import { scrapePublicProfile } from "@/lib/scrape";
import { notifyNewMatch } from "@/lib/notify";

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
  const fields: Record<string, any> = {
    user_id: user.id,
    goals: s(formData.get("goals")),
    deal_preferences: s(formData.get("deal_preferences")),
    communication_style: s(formData.get("communication_style")),
    deal_breakers: s(formData.get("deal_breakers")),
    ai_export_blob: s(formData.get("ai_export_blob")),
    hometown: s(formData.get("hometown")),
    current_city: s(formData.get("current_city")),
    achievements: s(formData.get("achievements")),
    updated_at: new Date().toISOString()
  };

  // Build a single profile update — only set the columns the user touched.
  const profileUpdate: Record<string, string | null> = {};
  if (display_name !== null) profileUpdate.display_name = display_name;
  if (avatar_url !== null) profileUpdate.avatar_url = avatar_url;

  // Auto-generate the portfolio handle (URL slug for /u/<handle>) if the
  // user doesn't have one yet. Best-effort uniqueness — fall back to a
  // random suffix on collision so we never block the onboarding save on
  // this. The user can change it later from the portfolio edit panel.
  try {
    const { data: existing } = await supabase
      .from("profiles")
      .select("handle")
      .eq("id", user.id)
      .maybeSingle();
    if (!(existing as any)?.handle && display_name) {
      let candidate = slugifyHandle(display_name);
      for (let attempt = 0; attempt < 4; attempt++) {
        const { data: collide } = await supabase
          .from("profiles")
          .select("id")
          .ilike("handle", candidate)
          .maybeSingle();
        if (!collide) break;
        candidate = `${slugifyHandle(display_name)}-${Math.random()
          .toString(36)
          .slice(2, 6)}`;
      }
      profileUpdate.handle = candidate;
    }
  } catch {
    /* handle column may not yet exist in prod — skip silently */
  }

  if (Object.keys(profileUpdate).length > 0) {
    await supabase
      .from("profiles")
      .update(profileUpdate)
      .eq("id", user.id);
  }

  // Try the full upsert (includes the new `achievements` column).
  // Fall back to the legacy field set if the column isn't migrated on
  // this DB yet — onboarding must always succeed end-to-end.
  const { error: upErr } = await supabase
    .from("twin_profiles")
    .upsert(fields, { onConflict: "user_id" });
  if (upErr && /achievements|column|schema cache/i.test(upErr.message)) {
    const { achievements: _drop, ...legacy } = fields;
    await supabase
      .from("twin_profiles")
      .upsert(legacy, { onConflict: "user_id" });
  }

  // Portfolio-from-LinkedIn auto-pull. If the user's blob contains a
  // LinkedIn URL and they don't yet have portfolio_about set, scrape the
  // profile and pre-fill it. Best-effort — never blocks the save. Lives
  // here so the user's /u/<handle> portfolio page renders MEANINGFULLY
  // the first time they visit it.
  try {
    const service = createServiceClient();
    const { data: profRow } = await service
      .from("profiles")
      .select("portfolio_about")
      .eq("id", user.id)
      .maybeSingle();
    const alreadyHasAbout =
      ((profRow as any)?.portfolio_about ?? "").toString().trim().length > 40;
    if (!alreadyHasAbout) {
      const blob = (fields.ai_export_blob ?? "").toString();
      const linkedInMatch = blob.match(
        /https?:\/\/(?:www\.)?linkedin\.com\/in\/[a-z0-9-]+\/?/i
      );
      if (linkedInMatch) {
        try {
          const scraped = await scrapePublicProfile(linkedInMatch[0]);
          if (scraped && scraped.trim().length > 80) {
            // Use the first ~700 chars of the cleaned scrape as the
            // initial portfolio About copy. The user can edit any time.
            const aboutSeed = scraped.trim().slice(0, 700);
            await service
              .from("profiles")
              .update({ portfolio_about: aboutSeed })
              .eq("id", user.id);
          }
        } catch (e) {
          console.warn(
            "[onboarding] portfolio LinkedIn pre-fill scrape failed",
            e
          );
        }
      }
    }
  } catch {
    /* portfolio columns may not yet exist in prod — silent skip */
  }

  // Fire-and-forget: ping every existing user whose match_threshold is
  // crossed by this newly-onboarded user. Wrapped in void + try/catch so
  // a notification fan-out failure never blocks the redirect to dashboard.
  void (async () => {
    try {
      await notifyNewMatch({ newUserId: user.id });
    } catch (e) {
      console.warn("[onboarding] notifyNewMatch failed", e);
    }
  })();

  revalidatePath("/dashboard");
  revalidatePath("/onboarding");
  // ?saved=1 lets the dashboard scroll to top + show a confirmation.
  // Without it, browser scroll-restoration kept the page anchored to
  // wherever the user last was, landing them at the bottom.
  redirect("/dashboard?saved=1");
}
