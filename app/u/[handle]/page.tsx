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

// Per-request render — the page renders fresh data + needs the viewer's
// auth cookie to decide whether to show owner-only edit affordances.
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
    accent: "#6b2dc9",
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
    title: `${name} · SyncedIn`,
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

  // Split the lookup into CORE (always-present columns) and OPTIONAL
  // (portfolio_about, portfolio_theme, is_test_persona may not yet be
  // migrated on a given prod DB). Without the split, selecting a missing
  // column threw and the whole row came back null — every freshly-built
  // portfolio 404'd. Jack hit this on /u/jackson-jesionowski.
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

  // Fallback: if no profile matches by handle, also try matching by a
  // slug of the display_name. Catches the case where the user clicked
  // "build portfolio" but the row update silently no-op'd (schema-cache
  // miss recovery) — we can still render their page deterministically.
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
      // Exact slug match first; then prefix-tolerant so a display name with
      // a suffix ("Raghavendra Reddy · Founder" → "raghavendra-reddy-founder")
      // still resolves from a name-only link like /u/raghavendra-reddy.
      const match =
        rows.find((p) => p.display_name && norm(p.display_name) === handle) ||
        rows.find((p) => {
          if (!p.display_name) return false;
          const n = norm(p.display_name);
          return n.startsWith(`${handle}-`) || handle.startsWith(`${n}-`);
        });
      if (match) coreProfile = match;
    } catch {
      /* still null */
    }
  }

  if (!coreProfile) notFound();

  // OPTIONAL columns — fetched separately so a missing column on prod
  // doesn't take down the whole page. These were added via later
  // migrations and may not exist on every deployed DB.
  let portfolio_about: string | null = null;
  let portfolio_theme: Theme | null = null;
  let portfolio_page: PortfolioPage | null = null;
  let is_test_persona = false;
  // Split into INDIVIDUAL selects per column. The previous bundled select
  // failed silently when ANY one column was missing on a given DB, leaving
  // portfolio_page = null even when the column was fully populated (Jack's
  // /u/jackson-jesionowski rendered the legacy template even though his
  // portfolio_page had 7 sections in DB — the bundled query failed because
  // one of the other columns errored, and the try/catch around it didn't
  // catch because Supabase JS returns errors in the response object, not
  // as throws). Per-column selects make each failure isolated.
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

  // Owner check — only the signed-in user matching this profile sees the
  // edit affordances.
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

  // CUSTOM-SITE PATH: if the user has a generated portfolio_page JSON,
  // render the rich multi-section CustomSite instead of the legacy
  // template. This is the "amazing custom website" Jack asked for —
  // every user gets a different layout, accent, section ordering.
  // Generated by /api/portfolio-generate via Claude over the full
  // twin context (twin_profiles + ai_export_blob + recent conv
  // summaries). Falls back to the legacy template below if the
  // JSON is missing or empty.
  if (portfolio_page && portfolio_page.sections?.length > 0) {
    return (
      <>
        <CustomSite
          page={portfolio_page}
          ownerId={profile.id}
          name={name}
          email={profile.email}
          handle={(profile.handle as string) ?? handle}
          avatarUrl={profile.avatar_url}
          isOwner={isOwner}
        />
        {/* #257 — MySpace-in-real-time strip. Lives ON the public
            portfolio so each visit feels alive: pulse status, what
            they're currently working on, Top 8 connections, recent
            "right now" feed. The viral hook is the page never feeling
            static. */}
        <div style={{ maxWidth: 880, margin: "0 auto", padding: "0 20px" }}>
          <RealtimeStrip
            userId={profile.id}
            selfName={name}
            goalsHighlight={(twin as any)?.goals ?? null}
          />
          {!isOwner && (
            <section className="mt-8 mb-12 retro-panel p-6 border border-[var(--border-bright)] retro-shadow">
              <div className="flex items-center gap-2">
                <span className="text-lg">⚡</span>
                <div className="retro-label">Pitch {name}'s AI Twin</div>
              </div>
              <h2 className="text-lg font-bold text-[var(--text)] mt-1">
                Test mutual leverage before booking a call
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-[var(--text-dim)] leading-relaxed">
                Pitch your startup, role, or collaboration. {name}'s AI Twin evaluates compatibility and surfaces win-win synergies in real time.
              </p>
              <ProfilePreviewForm handle={handle} name={name} />
            </section>
          )}
        </div>
        {isOwner && <RegenerateButton hasExisting={true} />}
      </>
    );
  }

  // "Recent context" raw-scrape section removed (Jack: "on people's
  // profiles, we don't need to show recent context like the actual
  // scrape. That doesn't look good"). The ai_export_blob is still
  // used to BUILD portfolio_page via Claude — we just don't dump
  // the raw markdown chunks onto the public page anymore. The blob
  // is internal twin-context, not user-facing copy. Holding the
  // empty array so the conditional render below evaluates to nothing
  // without restructuring the JSX.
  const blocks: string[] = [];

  return (
    <main
      style={{
        minHeight: "100vh",
        background: theme.bg
      }}
    >
      <div className="max-w-3xl mx-auto px-5 py-8">
        {/* Top navigation */}
        <div className="flex items-center justify-between pb-4">
          <Link href="/" aria-label="SyncedIn" className="hover:opacity-85 transition-opacity">
            <Wordmark />
          </Link>
          <div className="flex items-center gap-2">
            {isOwner ? (
              <>
                <ShareButton handle={handle} />
                <Link
                  href="/dashboard"
                  className="retro-btn"
                  style={{ fontSize: 12 }}
                >
                  dashboard →
                </Link>
              </>
            ) : (
              <>
                <ShareButton handle={handle} />
                <Link
                  href={`/login?next=/u/${handle}`}
                  className="retro-btn retro-btn-primary"
                  style={{ fontSize: 12 }}
                >
                  + build your twin
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Hero Identity Card */}
        <div className="mt-4 p-6 rounded-2xl retro-panel retro-shadow border border-[var(--border-bright)] relative overflow-hidden">
          {/* Subtle accent glow behind avatar */}
          <div
            className="absolute top-0 right-0 w-64 h-64 rounded-full pointer-events-none opacity-20 blur-3xl"
            style={{ background: theme.accent || "var(--amber)" }}
          />

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 relative z-10">
            <div className="relative">
              <Avatar
                id={profile.id}
                name={name}
                avatarUrl={profile.avatar_url}
                size={72}
              />
              <span
                className="absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-[var(--panel-solid)] bg-emerald-400"
                title="AI Twin Active"
              />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--text)]">
                  {name}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-[var(--panel-2)] border border-[var(--border)] text-[var(--text-dim)]">
                  @{handle}
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Twin Active
                </span>
              </div>

              {(twin?.current_city || twin?.hometown || theme.vibe) && (
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-[var(--text-dim)]">
                  {(twin?.current_city || twin?.hometown) && (
                    <span className="flex items-center gap-1">
                      📍 {twin?.current_city || twin?.hometown}
                    </span>
                  )}
                  {theme.vibe && (
                    <span className="px-2 py-0.5 rounded-md bg-[var(--panel-2)] border border-[var(--border)] font-mono uppercase text-[10px] tracking-wider text-[var(--amber-bright)]">
                      {theme.banner_emoji} {theme.vibe}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {profile.portfolio_about && (
            <div className="mt-5 pt-4 border-t border-[var(--border)] text-sm text-[var(--text)] leading-relaxed">
              {profile.portfolio_about}
            </div>
          )}
        </div>

        {/* Structured Focus Cards */}
        <div className="mt-6 space-y-4">
          {twin?.goals && (
            <section className="retro-panel p-5 border-l-4 border-l-[var(--amber)]">
              <div className="flex items-center gap-2">
                <span className="text-base">🎯</span>
                <div className="retro-label">What I'm Building & Working Toward</div>
              </div>
              <p className="mt-2.5 text-sm text-[var(--text)] leading-relaxed">
                {twin.goals}
              </p>
            </section>
          )}

          {twin?.deal_preferences && (
            <section className="retro-panel p-5 border-l-4 border-l-emerald-500">
              <div className="flex items-center gap-2">
                <span className="text-base">🤝</span>
                <div className="retro-label" style={{ color: "var(--green)" }}>Looking For & Open To</div>
              </div>
              <p className="mt-2.5 text-sm text-[var(--text)] leading-relaxed">
                {twin.deal_preferences}
              </p>
            </section>
          )}

          {twin?.deal_breakers && (
            <section className="retro-panel p-5 border-l-4 border-l-rose-500/80">
              <div className="flex items-center gap-2">
                <span className="text-base">🛑</span>
                <div className="retro-label" style={{ color: "var(--red)" }}>Not Interested In / Deal-Breakers</div>
              </div>
              <p className="mt-2.5 text-sm text-[var(--text)] leading-relaxed">
                {twin.deal_breakers}
              </p>
            </section>
          )}
        </div>

        {/* Pitch / Talk to Twin Section */}
        <section className="mt-8 retro-panel p-6 border border-[var(--border-bright)] retro-shadow">
          <div className="flex items-center gap-2">
            <span className="text-lg">⚡</span>
            <div className="retro-label">Pitch {name}'s AI Twin</div>
          </div>
          <h2 className="text-lg font-bold text-[var(--text)] mt-1">
            Test compatibility before booking a call
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-[var(--text-dim)] leading-relaxed">
            Pitch your startup, role, or collaboration idea. {name}'s AI Twin screens for mutual leverage in real time and highlights win-win synergies.
          </p>

          {isOwner ? (
            <div className="mt-4 p-4 rounded-xl bg-[var(--panel-2)] border border-[var(--border)] flex items-center justify-between gap-3">
              <div className="text-xs text-[var(--text-dim)]">
                You are viewing your own profile as an owner.
              </div>
              <Link
                href="/dashboard"
                className="retro-btn retro-btn-primary text-xs"
              >
                open dashboard →
              </Link>
            </div>
          ) : (
            <ProfilePreviewForm handle={handle} name={name} />
          )}
        </section>

        {/* Owner-only editor. The full prompt-driven backend lands next
            iteration; right now this writes portfolio_about + theme.vibe
            so the page is editable today. */}
        {isOwner && (
          <PortfolioEditor
            handle={handle}
            initialAbout={(profile.portfolio_about as string) || ""}
            initialTheme={theme}
          />
        )}
      </div>
      {/* On the legacy template, give the owner a Generate button so
          they can flip to the custom Claude-designed site. Hidden for
          non-owners (they shouldn't trigger Anthropic spend). */}
      {isOwner && <RegenerateButton hasExisting={false} />}
    </main>
  );
}
