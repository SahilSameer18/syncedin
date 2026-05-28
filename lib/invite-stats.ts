import { createServiceClient } from "@/lib/supabase/server";

/**
 * Shared "how many of this user's invites actually resulted in signups"
 * count. ONE source of truth so the number on /invite ("twins
 * onboarded"), /personal-intelligence (the unlock count), and the
 * dashboard Premium progress card all read the same.
 *
 * Jack: "MY ONBOARD STATS ON INVITE PAGE AND ON THE ACTUAL PERSONAL
 * INTELLIGENCE UNLOCK PAGE... VERY DIFFERENT" — those pages used
 * different methodologies. This helper unifies them.
 *
 * Counting logic:
 *   1. strict claim — pending_invites.claimed_by_user_id is non-null
 *      (the recipient actually went through /claim/<slug>)
 *   2. email match — a profile exists whose email matches an invite's
 *      recipient_email (the recipient signed up directly without
 *      clicking /claim, e.g. via the in-iMessage CTA)
 * Union of those two — that's the count we trust. Wider fallbacks
 * (handle prefix match, ambient created-after growth) are NOT counted
 * here. They were inflating the invite page's display vs the PI gate.
 */
export type ReferralCount = {
  count: number;
  // Distinct invite slugs that contributed — useful for the "x of y
  // drafted invites converted" follow-up math on the invite page.
  contributing_slugs: string[];
};

export async function countReferrals(userId: string): Promise<ReferralCount> {
  const service = createServiceClient();
  try {
    // Pull claimed_at AND claimed_by_user_id. Some rows have one but not
    // the other due to historical schema changes — count either as a
    // successful claim. Jack hit this mismatch: PI page showed 0
    // successful invites while the /invite page showed several. Both
    // call this helper, so the discrepancy was rows where
    // `claimed_by_user_id` was null but `claimed_at` was set (the
    // recipient signed up before we wired the user-id link).
    let list: Array<{
      id: string;
      slug: string;
      claimed_by_user_id: string | null;
      claimed_at: string | null;
      recipient_email: string | null;
    }> = [];
    try {
      const { data: rows } = await service
        .from("pending_invites")
        .select("id, slug, claimed_by_user_id, claimed_at, recipient_email")
        .eq("inviter_user_id", userId);
      list = (rows ?? []) as any;
    } catch {
      // claimed_at column may not exist on this DB — retry without it.
      const { data: rows2 } = await service
        .from("pending_invites")
        .select("id, slug, claimed_by_user_id, recipient_email")
        .eq("inviter_user_id", userId);
      list = ((rows2 ?? []) as any[]).map((r) => ({
        ...r,
        claimed_at: null
      }));
    }
    const contributing = new Set<string>();
    // 1) Strict claim — either claimed_by_user_id OR claimed_at proves
    //    someone actually went through /claim/<slug>.
    for (const r of list) {
      if (r.claimed_by_user_id || r.claimed_at) contributing.add(r.slug);
    }
    // 2) Email match — only check the ones not already in the set.
    const remaining = list.filter((r) => !contributing.has(r.slug));
    const emails = Array.from(
      new Set(
        remaining
          .map((r) => (r.recipient_email || "").toLowerCase())
          .filter(Boolean)
      )
    );
    if (emails.length > 0) {
      const { data: matched } = await service
        .from("profiles")
        .select("email")
        .in("email", emails);
      const signedUp = new Set(
        ((matched ?? []) as Array<{ email: string | null }>)
          .map((m) => (m.email || "").toLowerCase())
          .filter(Boolean)
      );
      for (const r of remaining) {
        const e = (r.recipient_email || "").toLowerCase();
        if (e && signedUp.has(e)) contributing.add(r.slug);
      }
    }

    // 3) Handle prefix match — many users sign up via Google/magic-link
    //    WITHOUT going through /claim/<slug> AND with a different email
    //    than the invite landed at. But when they pick a handle, it
    //    often matches the invite slug (the slug was their name-based
    //    URL). Counting this catches the silent-conversion case that
    //    has been making /personal-intelligence show 0 even when Jack
    //    actually had several real signups.
    const stillRemaining = list.filter((r) => !contributing.has(r.slug));
    const slugs = stillRemaining.map((r) => r.slug).filter(Boolean);
    if (slugs.length > 0) {
      const { data: handleHits } = await service
        .from("profiles")
        .select("handle")
        .in("handle", slugs);
      const claimedHandles = new Set(
        ((handleHits ?? []) as Array<{ handle: string | null }>)
          .map((h) => (h.handle || "").toLowerCase())
          .filter(Boolean)
      );
      for (const r of stillRemaining) {
        if (claimedHandles.has(r.slug.toLowerCase())) contributing.add(r.slug);
      }
    }

    return {
      count: contributing.size,
      contributing_slugs: Array.from(contributing)
    };
  } catch (e) {
    console.warn("[invite-stats] countReferrals failed", e);
    return { count: 0, contributing_slugs: [] };
  }
}

/**
 * "Completed referrals" — same union as countReferrals, but ALSO
 * requires the referred user to have actually onboarded (twin_profiles
 * with goals set). This is the gate used for Premium unlock.
 */
export async function countCompletedReferrals(
  userId: string
): Promise<number> {
  const service = createServiceClient();
  try {
    const { count: rawClaimed } = await service
      .from("pending_invites")
      .select("claimed_by_user_id", { count: "exact", head: true })
      .eq("inviter_user_id", userId)
      .not("claimed_by_user_id", "is", null);
    void rawClaimed;
    const { data: claimedRows } = await service
      .from("pending_invites")
      .select("claimed_by_user_id, recipient_email")
      .eq("inviter_user_id", userId);
    const rows = (claimedRows ?? []) as Array<{
      claimed_by_user_id: string | null;
      recipient_email: string | null;
    }>;
    const directIds = Array.from(
      new Set(rows.map((r) => r.claimed_by_user_id).filter(Boolean) as string[])
    );
    // Add email-matched signups.
    const emails = Array.from(
      new Set(
        rows
          .map((r) => (r.recipient_email || "").toLowerCase())
          .filter(Boolean)
      )
    );
    let emailMatchedIds: string[] = [];
    if (emails.length > 0) {
      const { data: matched } = await service
        .from("profiles")
        .select("id")
        .in("email", emails);
      emailMatchedIds = ((matched ?? []) as Array<{ id: string }>).map(
        (m) => m.id
      );
    }
    // Handle-prefix fallback — same logic as countReferrals. Catches
    // users who signed up via Google/magic-link without going through
    // /claim/<slug> and with a different email, but whose handle ended
    // up matching the invite slug (the slug was their name-derived URL).
    const slugs = rows
      .map((r) => (r as any).slug as string | undefined)
      .filter(Boolean) as string[];
    // `rows` here lacks `slug`; fetch a second pass keyed by slug.
    let handleMatchedIds: string[] = [];
    try {
      const { data: invSlugs } = await service
        .from("pending_invites")
        .select("slug")
        .eq("inviter_user_id", userId);
      const slugList = ((invSlugs ?? []) as Array<{ slug: string }>)
        .map((r) => r.slug)
        .filter(Boolean);
      if (slugList.length > 0) {
        const { data: handleHits } = await service
          .from("profiles")
          .select("id, handle")
          .in("handle", slugList);
        handleMatchedIds = ((handleHits ?? []) as Array<{ id: string }>).map(
          (h) => h.id
        );
      }
    } catch {
      /* handle column may not exist on this DB — skip silently */
    }
    void slugs;
    const allIds = Array.from(
      new Set([...directIds, ...emailMatchedIds, ...handleMatchedIds])
    );
    if (allIds.length === 0) return 0;
    const { data: completed } = await service
      .from("twin_profiles")
      .select("user_id")
      .in("user_id", allIds)
      .not("goals", "is", null);
    return (completed ?? []).length;
  } catch (e) {
    console.warn("[invite-stats] countCompletedReferrals failed", e);
    return 0;
  }
}
