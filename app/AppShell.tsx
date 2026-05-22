import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { MobileShell } from "./MobileShell";
import { SitewidePrefetch } from "./SitewidePrefetch";
import { signOut } from "./login/actions";

/**
 * AppShell — wraps every signed-in page with the persistent left sidebar.
 * The sidebar holds the logo, primary actions ("+ new"), nav, conferences,
 * theme toggle, and sign out — so the main column starts immediately with
 * page content, no chrome bar above it.
 *
 * Server component so the auth check + profile + conferences fetch run on
 * the edge before any client JS hydrates.
 */
export async function AppShell({
  children,
  // All AppShell pages share the SAME outer width so the sidebar's left
  // edge is identical from page to page. Without this, navigating between
  // a max-w-6xl page and a max-w-7xl page made the whole sidebar jump
  // horizontally — the user's eye lost its anchor on every nav.
  maxWidth = "max-w-7xl",
  // Optional rail slot that renders BELOW the sidebar nav in the same
  // 200px left column on lg+ (and inside the mobile drawer below the
  // nav). Dashboard passes its SyncMeter card here so the clone meter
  // sits in-line under the menu instead of in a separate right column.
  // Jack: "this human clone part we can put under it in line."
  sidebarExtra
}: {
  children: React.ReactNode;
  maxWidth?: string;
  sidebarExtra?: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Capture userId locally so the helpers below + every reference here
  // have a non-nullable reference (TS doesn't carry the narrowing from
  // the redirect check into nested async functions).
  const userId = user.id;

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, avatar_url, email, handle")
    .eq("id", userId)
    .maybeSingle();

  // Display name fallback chain. Jack: "It says Jackson J-E-Z-I-O,
  // but it should just say Jackson Jesionowski."
  // Order:
  //   1. profiles.display_name (real name set in onboarding)
  //   2. twin_profiles.ai_export_blob doesn't help here (no name field)
  //   3. email username prettified — "jacksonjezio" → "Jacksonjezio"
  //   4. "you" as last resort
  function prettifyEmailUsername(raw: string): string {
    // Split on common separators + camelCase boundaries.
    const parts = raw
      .replace(/[._-]+/g, " ")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    return parts
      .map((p) => p[0].toUpperCase() + p.slice(1))
      .join(" ");
  }
  const emailUsername = user.email?.split("@")[0] ?? "";
  const displayName =
    (profile?.display_name && profile.display_name.trim()) ||
    (emailUsername ? prettifyEmailUsername(emailUsername) : "you");

  // Conferences in the sidebar — fetched in two safe steps so a transient
  // join failure or a missing FK relationship hint can't crash the entire
  // shell (which would 500 every signed-in page). If anything throws, the
  // sidebar just renders without the "Your conferences" section.
  let conferences: { slug: string; name: string }[] = [];
  try {
    const { data: memberRows } = await supabase
      .from("conference_members")
      .select("conference_slug")
      .eq("user_id", userId);
    const slugs = (memberRows ?? []).map((r: any) => r.conference_slug);
    if (slugs.length > 0) {
      const { data: confs } = await supabase
        .from("conferences")
        .select("slug, name")
        .in("slug", slugs);
      conferences = (confs ?? []).map((c: any) => ({
        slug: c.slug as string,
        name: c.name as string
      }));
    }
  } catch (e) {
    console.warn("[AppShell] conferences sidebar fetch failed", e);
  }

  // === Unread counts for the sidebar's red badges ===
  // Three counts: /messages (a message from the other side arrived
  // after my last_read), /poll (a poll exists I haven't responded
  // to), /proposals (a conversation has a summary I haven't acted on).
  //
  // Parallelized May 2026 (Jack: "jitteriness when clicking around
  // the menu and it's like reloading items"). Previously these three
  // blocks ran sequentially, costing ~3x the round-trip latency on
  // every page navigation. Now Promise.allSettled fires them in
  // parallel so the shell renders in one round-trip's time.
  const unreadCounts: Record<string, number> = {};

  async function computeMessagesUnread(): Promise<number> {
    const { data: convs } = await supabase
      .from("conversations")
      .select(
        "id, participant_a, participant_b, last_read_a, last_read_b, created_at"
      )
      .or(`participant_a.eq.${userId},participant_b.eq.${userId}`);
    const myConvs = (convs ?? []) as any[];
    const convIds = myConvs.map((c) => c.id);
    if (convIds.length === 0) return 0;
    const { data: msgs } = await supabase
      .from("messages")
      .select("conversation_id, sender_user_id, sent_at")
      .in("conversation_id", convIds)
      .neq("sender_user_id", userId)
      .order("sent_at", { ascending: false });
    const latestByConv = new Map<string, string>();
    for (const m of ((msgs ?? []) as any[])) {
      if (!latestByConv.has(m.conversation_id)) {
        latestByConv.set(m.conversation_id, m.sent_at);
      }
    }
    let n = 0;
    for (const c of myConvs) {
      const isA = c.participant_a === userId;
      const myLastRead = isA ? c.last_read_a : c.last_read_b;
      const latest = latestByConv.get(c.id);
      if (!latest) continue;
      if (!myLastRead || new Date(latest) > new Date(myLastRead)) n += 1;
    }
    return n;
  }

  async function computePollUnread(): Promise<number> {
    const { data: polls } = await supabase
      .from("polls")
      .select("id, status")
      .neq("status", "closed");
    const pollIds = ((polls ?? []) as any[]).map((p) => p.id);
    if (pollIds.length === 0) return 0;
    const { data: myResponses } = await supabase
      .from("poll_responses")
      .select("poll_id")
      .eq("twin_user_id", userId)
      .in("poll_id", pollIds);
    const respondedSet = new Set(
      ((myResponses ?? []) as any[]).map((r) => r.poll_id)
    );
    return pollIds.filter((id: string) => !respondedSet.has(id)).length;
  }

  async function computeProposalsUnread(): Promise<number> {
    const { data: convs } = await supabase
      .from("conversations")
      .select("id, participant_a, participant_b, summary")
      .or(`participant_a.eq.${userId},participant_b.eq.${userId}`)
      .not("summary", "is", null);
    const convIds = ((convs ?? []) as any[]).map((c) => c.id);
    if (convIds.length === 0) return 0;
    const { data: myResps } = await supabase
      .from("agreement_responses")
      .select("conversation_id")
      .eq("user_id", userId)
      .in("conversation_id", convIds);
    const respondedSet = new Set(
      ((myResps ?? []) as any[]).map((r) => r.conversation_id)
    );
    return convIds.filter((id: string) => !respondedSet.has(id)).length;
  }

  const [msgRes, pollRes, propRes] = await Promise.allSettled([
    computeMessagesUnread(),
    computePollUnread(),
    computeProposalsUnread()
  ]);
  if (msgRes.status === "fulfilled" && msgRes.value > 0)
    unreadCounts["/messages"] = msgRes.value;
  if (pollRes.status === "fulfilled" && pollRes.value > 0)
    unreadCounts["/poll"] = pollRes.value;
  if (propRes.status === "fulfilled" && propRes.value > 0)
    unreadCounts["/proposals"] = propRes.value;

  // Render the Sidebar ONCE — it gets handed both to the desktop slot
  // (hidden < lg) and to the MobileShell drawer (hidden ≥ lg) so the same
  // server-fetched data backs both surfaces.
  const sidebar = (
    <Sidebar
      userId={userId}
      displayName={displayName}
      avatarUrl={(profile as any)?.avatar_url ?? null}
      signOutAction={signOut}
      conferences={conferences}
      unreadCounts={unreadCounts}
    />
  );

  return (
    <>
      {/* Mobile chrome — hamburger top bar + slide-in drawer holding the
          full sidebar. Hidden on lg+. */}
      <MobileShell>{sidebar}</MobileShell>

      {/* Warm the router cache for every primary nav destination so
          clicks anywhere in the app feel instant. Mounted ONCE per
          authed page via AppShell so the prefetch only fires for
          signed-in users (where the routes are reachable). */}
      <SitewidePrefetch />

      {/* Desktop top bar — hypernetwork, sync a conference, sync a
          community lift up here. Profile avatar lives top-right with
          a dropdown for Edit twin / Settings / Sign out. Hidden on
          mobile because MobileShell already owns the top strip there. */}
      <div className="hidden lg:block">
        <TopBar
          userId={userId}
          displayName={displayName}
          avatarUrl={(profile as any)?.avatar_url ?? null}
          portfolioHandle={(profile as any)?.handle ?? null}
          signOutAction={signOut}
          unreadCounts={unreadCounts}
        />
      </div>

      {/* pt-0 on mobile because MobileShell already gives us a top bar.
          Stacking another pt-3 below it created the huge empty band Jack
          flagged. lg+ keeps the standard pt-3 since there's no mobile bar
          eating vertical real estate up top.
          —
          Flush-left sidebar (Jack: "Let's move the menu all the way to
          the left of the screen"). On lg+ we drop the left padding +
          the max-w gutter so the sidebar sits against the viewport edge.
          The main content keeps its readable max-width via its own
          inner wrapper. */}
      <main
        className={`mx-auto px-4 lg:pl-4 lg:pr-5 pt-0 lg:pt-1 pb-6 grid lg:grid-cols-[200px_1fr] gap-4 lg:gap-6 items-start ${maxWidth} lg:max-w-none`}
      >
        {/* Desktop sidebar — hidden on mobile, replaced by MobileShell drawer.
            Sticky on lg+ so it stays in view as the main content scrolls.
            top:12 leaves a hair of breathing room below the viewport top;
            maxHeight + overflow keep tall sidebars (lots of conferences)
            from going off the bottom of the screen. */}
        <div
          className="hidden lg:block"
          style={{
            position: "sticky",
            top: 12,
            alignSelf: "start",
            maxHeight: "calc(100vh - 24px)",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 10
          }}
        >
          {sidebar}
          {sidebarExtra && <div>{sidebarExtra}</div>}
        </div>

        <div className="min-w-0">{children}</div>
      </main>
    </>
  );
}
