import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "./Sidebar";
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
  maxWidth = "max-w-7xl"
}: {
  children: React.ReactNode;
  maxWidth?: string;
}) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, avatar_url, email")
    .eq("id", user.id)
    .maybeSingle();

  const displayName =
    profile?.display_name || user.email?.split("@")[0] || "you";

  // Conferences in the sidebar — fetched in two safe steps so a transient
  // join failure or a missing FK relationship hint can't crash the entire
  // shell (which would 500 every signed-in page). If anything throws, the
  // sidebar just renders without the "Your conferences" section.
  let conferences: { slug: string; name: string }[] = [];
  try {
    const { data: memberRows } = await supabase
      .from("conference_members")
      .select("conference_slug")
      .eq("user_id", user.id);
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

  // Render the Sidebar ONCE — it gets handed both to the desktop slot
  // (hidden < lg) and to the MobileShell drawer (hidden ≥ lg) so the same
  // server-fetched data backs both surfaces.
  const sidebar = (
    <Sidebar
      userId={user.id}
      displayName={displayName}
      avatarUrl={(profile as any)?.avatar_url ?? null}
      signOutAction={signOut}
      conferences={conferences}
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

      {/* pt-0 on mobile because MobileShell already gives us a top bar.
          Stacking another pt-3 below it created the huge empty band Jack
          flagged. lg+ keeps the standard pt-3 since there's no mobile bar
          eating vertical real estate up top. */}
      <main
        className={`${maxWidth} mx-auto px-4 lg:px-5 pt-0 lg:pt-3 pb-6 grid lg:grid-cols-[220px_1fr] gap-4 lg:gap-6 items-start`}
      >
        {/* Desktop sidebar — hidden on mobile, replaced by MobileShell drawer */}
        <div className="hidden lg:block">{sidebar}</div>

        <div className="min-w-0">{children}</div>
      </main>
    </>
  );
}
