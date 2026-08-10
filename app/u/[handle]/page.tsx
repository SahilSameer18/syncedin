import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { Wordmark } from "../../Wordmark";
import { Avatar } from "../../Avatar";
import { PortfolioEditor } from "./PortfolioEditor";
import { CustomSite, type PortfolioPage } from "./CustomSite";
import { RegenerateButton } from "./RegenerateButton";
import { RealtimeStrip } from "./RealtimeStrip";
import { ProfilePreviewForm, ShareButton } from "./ProfilePreviewForm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Theme = {
  accent?: string;
  bg?: string;
  banner_emoji?: string;
  vibe?: string;
};

function defaultTheme(): Theme {
  return {
    accent: "#7c3aed",
    bg: "linear-gradient(180deg, #f4f3ff 0%, #ffffff 60%)",
    banner_emoji: "✨",
    vibe: "founder-in-flight"
  };
}

export async function generateMetadata({
  params
}: {
  params: { handle: string };
}): Promise<Metadata> {
  const service = createServiceClient();
  const { data: p } = await service
    .from("profiles")
    .select("display_name, portfolio_about")
    .ilike("handle", params.handle)
    .maybeSingle();
  if (!p) return {};
  const name = (p.display_name as string) || params.handle;
  const desc =
    ((p.portfolio_about as string) || "").slice(0, 180) ||
    `${name}'s portfolio on SyncedIn — what they're working on, what they're looking for, who their twin would love to talk to.`;
  return {
    title: `${name} · SyncedIn AI Twin`,
    description: desc,
    openGraph: { title: name, description: desc, type: "profile" }
  };
}

export default async function PortfolioPage({
  params
}: {
  params: { handle: string };
}) {
  const handle = (params.handle || "").toLowerCase();
  const service = createServiceClient();

  let coreProfile:
    | {
        id: string;
        display_name: string | null;
        email: string | null;
        avatar_url: string | null;
        handle: string | null;
      }
    | null = null;
  try {
    const { data } = await service
      .from("profiles")
      .select("id, display_name, email, avatar_url, handle")
      .ilike("handle", handle)
      .maybeSingle();
    coreProfile = (data as any) ?? null;
  } catch {
    coreProfile = null;
  }

  if (!coreProfile) {
    try {
      const { data } = await service
        .from("profiles")
        .select("id, display_name, email, avatar_url, handle");
      const norm = (s: string) =>
        s
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");
      const rows = (data ?? []) as any[];
      const match =
        rows.find((p) => p.display_name && norm(p.display_name) === handle) ||
        rows.find((p) => {
          if (!p.display_name) return false;
          const n = norm(p.display_name);
          return n.startsWith(`${handle}-`) || handle.startsWith(`${n}-`);
        });
      if (match) coreProfile = match;
    } catch {
      /* null */
    }
  }

  if (!coreProfile) notFound();

  let portfolio_about: string | null = null;
  let portfolio_theme: Theme | null = null;
  let portfolio_page: PortfolioPage | null = null;
  let is_test_persona = false;

  {
    const { data: row, error } = await service
      .from("profiles")
      .select("portfolio_page")
      .eq("id", coreProfile.id)
      .maybeSingle();
    if (!error && row) {
      portfolio_page = ((row as any).portfolio_page as PortfolioPage) ?? null;
    }
  }
  {
    const { data: row, error } = await service
      .from("profiles")
      .select("portfolio_about")
      .eq("id", coreProfile.id)
      .maybeSingle();
    if (!error && row) {
      portfolio_about = ((row as any).portfolio_about as string) ?? null;
    }
  }
  {
    const { data: row, error } = await service
      .from("profiles")
      .select("portfolio_theme")
      .eq("id", coreProfile.id)
      .maybeSingle();
    if (!error && row) {
      portfolio_theme = ((row as any).portfolio_theme as Theme) ?? null;
    }
  }
  {
    const { data: row, error } = await service
      .from("profiles")
      .select("is_test_persona")
      .eq("id", coreProfile.id)
      .maybeSingle();
    if (!error && row) {
      is_test_persona = !!(row as any).is_test_persona;
    }
  }

  const profile = {
    ...coreProfile,
    portfolio_about,
    portfolio_theme,
    is_test_persona
  };

  const { data: twin } = await service
    .from("twin_profiles")
    .select(
      "goals, deal_preferences, communication_style, deal_breakers, ai_export_blob, hometown, current_city, updated_at"
    )
    .eq("user_id", profile.id)
    .maybeSingle();

  const supabase = createClient();
  const {
    data: { user: viewer }
  } = await supabase.auth.getUser();
  const isOwner = !!viewer && viewer.id === profile.id;

  const theme: Theme = {
    ...defaultTheme(),
    ...((profile.portfolio_theme as Theme) ?? {})
  };
  const name = (profile.display_name as string) || handle;

  if (portfolio_page && portfolio_page.sections?.length > 0) {
    return (
      <main className="min-h-screen text-slate-900 selection:bg-purple-600 selection:text-white">
        <CustomSite
          page={portfolio_page}
          ownerId={profile.id}
          name={name}
          email={profile.email}
          handle={(profile.handle as string) ?? handle}
          avatarUrl={profile.avatar_url}
          isOwner={isOwner}
        />
        <div className="max-w-4xl mx-auto px-6 py-8">
          <RealtimeStrip
            userId={profile.id}
            selfName={name}
            goalsHighlight={(twin as any)?.goals ?? null}
          />
          {!isOwner && (
            <section className="mt-12 mb-16">
              <ProfilePreviewForm handle={handle} name={name} />
            </section>
          )}
        </div>
        {isOwner && <RegenerateButton hasExisting={true} />}
      </main>
    );
  }

  return (
    <main className="min-h-screen text-slate-900 selection:bg-purple-600 selection:text-white pb-16">
      <div className="max-w-4xl mx-auto px-6 py-8">
        
        {/* Top Header Nav */}
        <header className="flex items-center justify-between pb-6 border-b border-purple-100">
          <Link href="/" aria-label="SyncedIn">
            <Wordmark />
          </Link>
          <div className="flex items-center gap-3">
            <ShareButton name={name} handle={handle} />
            {isOwner ? (
              <Link
                href="/dashboard"
                className="btn-purple-pill text-xs py-2 px-4 shadow-sm"
              >
                Dashboard →
              </Link>
            ) : (
              <Link
                href={`/login?next=/u/${handle}`}
                className="btn-purple-pill text-xs py-2 px-4 shadow-sm"
              >
                + Build Your AI Twin
              </Link>
            )}
          </div>
        </header>

        {/* Hero Identity Card */}
        <div className="mt-8 p-8 clean-card relative overflow-hidden">
          <div
            className="absolute top-0 right-0 w-80 h-80 rounded-full pointer-events-none opacity-10 blur-3xl"
            style={{ background: theme.accent || "#7c3aed" }}
          />

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 relative z-10">
            <div className="relative">
              <Avatar
                id={profile.id}
                name={name}
                avatarUrl={profile.avatar_url}
                size={80}
              />
              <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center text-[10px] text-white font-bold" title="AI Twin Active">
                ✓
              </span>
            </div>

            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  {name}
                </h1>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
                  @{handle}
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Twin Active
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Autonomous AI Twin • Active on SyncedIn
              </p>
            </div>
          </div>

          {profile.portfolio_about && (
            <div className="mt-6 pt-5 border-t border-slate-100 text-sm text-slate-700 leading-relaxed">
              {profile.portfolio_about}
            </div>
          )}
        </div>

        {/* Realtime Strip & Pitch Sandbox */}
        <div className="mt-8 space-y-8">
          <RealtimeStrip
            userId={profile.id}
            selfName={name}
            goalsHighlight={(twin as any)?.goals ?? null}
          />

          {!isOwner && (
            <ProfilePreviewForm handle={handle} name={name} />
          )}

          {isOwner && (
            <div className="clean-card p-6 text-center space-y-3">
              <h3 className="text-base font-bold text-slate-900">Customize Your Public AI Bio Site</h3>
              <p className="text-xs text-slate-500">
                Generate a custom layout powered by AI over your goals and achievements.
              </p>
              <RegenerateButton hasExisting={false} />
            </div>
          )}
        </div>

        {isOwner && (
          <PortfolioEditor
            handle={handle}
            initialAbout={(profile.portfolio_about as string) || ""}
            initialTheme={theme}
          />
        )}
      </div>
      {isOwner && <RegenerateButton hasExisting={false} />}
    </main>
  );
}
