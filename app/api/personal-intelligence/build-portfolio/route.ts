import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/**
 * One-click portfolio builder. Assigns the user a handle on first call
 * (derived from display_name → email username → uuid) and returns the
 * public URL. Idempotent — calling again with an existing handle just
 * returns the same URL.
 *
 * Replaces the "go to settings → claim handle → come back" loop Jack
 * hit when the PI page's portfolio card routed to /settings instead
 * of actually building the page.
 */
function slugify(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);
}

export async function POST() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const service = createServiceClient();
  const { data: profile } = await service
    .from("profiles")
    .select("handle, display_name, email")
    .eq("id", user.id)
    .maybeSingle();

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "https://syncedin.org";

  // Already has a handle → idempotent return.
  if ((profile as any)?.handle) {
    return NextResponse.json({
      handle: (profile as any).handle,
      url: `${appUrl}/u/${(profile as any).handle}`,
      created: false
    });
  }

  // Pick a base handle. Prefer display_name, then email username.
  const seed =
    slugify((profile as any)?.display_name ?? "") ||
    slugify((user.email ?? "").split("@")[0]) ||
    `user-${user.id.slice(0, 6)}`;

  // Collision-safe loop. Try seed, seed-2, seed-3, ... up to seed-99,
  // then fall back to a uuid-tail to guarantee uniqueness.
  let handle = seed || `user-${user.id.slice(0, 6)}`;
  let attempt = 1;
  for (; attempt < 100; attempt++) {
    const candidate = attempt === 1 ? handle : `${handle}-${attempt}`;
    const { data: existing } = await service
      .from("profiles")
      .select("id")
      .eq("handle", candidate)
      .maybeSingle();
    if (!existing) {
      handle = candidate;
      break;
    }
    if (attempt === 99) {
      handle = `${seed}-${user.id.slice(0, 8)}`;
    }
  }

  const { error } = await service
    .from("profiles")
    .update({ handle })
    .eq("id", user.id);
  if (error) {
    return NextResponse.json(
      { error: "save_failed", detail: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    handle,
    url: `${appUrl}/u/${handle}`,
    created: true
  });
}
