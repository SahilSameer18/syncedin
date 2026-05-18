import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "./Sidebar";
import { ThemeToggle } from "./ThemeToggle";
import { signOut } from "./login/actions";

/**
 * AppShell — wraps every signed-in page with the persistent left sidebar
 * and a slim top bar (wordmark + theme + +new). Pages that use AppShell get
 * a consistent navigation chrome without each page hand-rolling its own header.
 *
 * Server component so the auth check + profile fetch run on the edge before
 * any client JS hydrates. Pages still own their own data loading; AppShell
 * just handles the chrome.
 *
 * If you need to render WITHOUT the top "+ new" button (e.g. inside a
 * conversation surface), pass topRight={null}.
 */
export async function AppShell({
  children,
  topRight,
  maxWidth = "max-w-6xl"
}: {
  children: React.ReactNode;
  topRight?: React.ReactNode | null;
  maxWidth?: string;
}) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: myConfs }] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, avatar_url, email")
      .eq("id", user.id)
      .maybeSingle(),
    // All conferences I'm a member of OR own — surfaced in the sidebar so
    // it's one click to switch context.
    supabase
      .from("conference_members")
      .select("conference_slug, conferences(slug, name)")
      .eq("user_id", user.id)
  ]);

  const displayName =
    profile?.display_name || user.email?.split("@")[0] || "you";

  const conferences = (myConfs ?? [])
    .map((m: any) => m.conferences)
    .filter(Boolean)
    .map((c: any) => ({ slug: c.slug as string, name: c.name as string }));

  const defaultTopRight = (
    <Link
      href="/conversations/new"
      className="retro-btn retro-btn-primary"
    >
      + new
    </Link>
  );

  return (
    <main
      className={`${maxWidth} mx-auto px-5 py-6 grid lg:grid-cols-[220px_1fr] gap-6 items-start`}
    >
      <Sidebar
        userId={user.id}
        displayName={displayName}
        avatarUrl={(profile as any)?.avatar_url ?? null}
        signOutAction={signOut}
        conferences={conferences}
      />

      <div className="min-w-0">
        {/* Slim top bar — wordmark moved into sidebar, leaving just utility */}
        <div className="flex items-center justify-end gap-3 text-sm mb-4">
          <ThemeToggle />
          {topRight === null ? null : topRight ?? defaultTopRight}
        </div>
        {children}
      </div>
    </main>
  );
}
