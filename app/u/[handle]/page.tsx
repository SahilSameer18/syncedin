import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { Wordmark } from "../../Wordmark";
import { Avatar } from "../../Avatar";
import { PortfolioEditor } from "./PortfolioEditor";

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
  const { data: profile } = await service
    .from("profiles")
    .select(
      "id, display_name, email, avatar_url, handle, portfolio_about, portfolio_theme, is_test_persona"
    )
    .ilike("handle", handle)
    .maybeSingle();
  if (!profile) notFound();

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

  // Pull one or two "recent context" snippets from ai_export_blob — these
  // are the markdown-headered chunks added via Sources + Life Update. Most
  // recent first.
  const blob = ((twin as any)?.ai_export_blob || "") as string;
  const blocks = blob
    .split(/\n(?=#\s+)/)
    .map((b) => b.trim())
    .filter((b) => b.length > 30)
    .slice(0, 4);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: theme.bg
      }}
    >
      <div className="max-w-3xl mx-auto px-5 py-8">
        <div className="flex items-center justify-between">
          <Link href="/" aria-label="SyncedIn">
            <Wordmark />
          </Link>
          {isOwner ? (
            <Link
              href="/dashboard"
              className="retro-btn"
              style={{ fontSize: 12 }}
            >
              dashboard →
            </Link>
          ) : (
            <Link
              href={`/login?next=/u/${handle}`}
              className="retro-btn retro-btn-primary"
            >
              + spin up your own twin
            </Link>
          )}
        </div>

        {/* Banner band — accent color + emoji + vibe label. Reads as the
            MySpace banner without leaning on user-uploaded media (which
            we'd have to host + moderate). */}
        <div
          className="mt-6 rounded-2xl p-6 flex items-center gap-4"
          style={{
            background: theme.accent,
            color: "#ffffff",
            boxShadow: `0 8px 32px ${theme.accent}33`
          }}
        >
          <div style={{ fontSize: 56, lineHeight: 1 }}>
            {theme.banner_emoji}
          </div>
          <div>
            <div
              style={{
                fontSize: 12,
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                opacity: 0.8
              }}
            >
              {theme.vibe}
            </div>
            <h1
              className="retro-h1"
              style={{ fontSize: 36, marginTop: 4, color: "#ffffff" }}
            >
              {name}
            </h1>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <Avatar
            id={profile.id}
            name={name}
            avatarUrl={profile.avatar_url}
            size={48}
          />
          <div>
            <div className="text-sm font-semibold">{name}</div>
            {(twin?.current_city || twin?.hometown) && (
              <div
                className="text-xs"
                style={{ color: "var(--text-dim)" }}
              >
                {twin?.current_city ?? ""}
                {twin?.current_city && twin?.hometown ? " · " : ""}
                {twin?.hometown ? `from ${twin.hometown}` : ""}
              </div>
            )}
          </div>
        </div>

        {profile.portfolio_about && (
          <section className="mt-6 retro-panel p-5">
            <div className="retro-label">about</div>
            <p
              className="mt-2 text-sm leading-relaxed"
              style={{ whiteSpace: "pre-wrap" }}
            >
              {profile.portfolio_about}
            </p>
          </section>
        )}

        {twin?.goals && (
          <section className="mt-4 retro-panel p-5">
            <div className="retro-label">what i'm working toward</div>
            <p
              className="mt-2 text-sm leading-relaxed"
              style={{ whiteSpace: "pre-wrap" }}
            >
              {twin.goals}
            </p>
          </section>
        )}

        {twin?.deal_preferences && (
          <section className="mt-4 retro-panel p-5">
            <div className="retro-label">looking for</div>
            <p
              className="mt-2 text-sm leading-relaxed"
              style={{ whiteSpace: "pre-wrap" }}
            >
              {twin.deal_preferences}
            </p>
          </section>
        )}

        {twin?.deal_breakers && (
          <section className="mt-4 retro-panel p-5">
            <div className="retro-label">not interested in</div>
            <p
              className="mt-2 text-sm leading-relaxed"
              style={{ whiteSpace: "pre-wrap" }}
            >
              {twin.deal_breakers}
            </p>
          </section>
        )}

        {blocks.length > 0 && (
          <section className="mt-4 retro-panel p-5">
            <div className="retro-label">recent context</div>
            <div className="mt-2 space-y-3">
              {blocks.map((b, i) => (
                <div
                  key={i}
                  className="text-xs"
                  style={{
                    color: "var(--text-dim)",
                    whiteSpace: "pre-wrap",
                    borderLeft: `2px solid ${theme.accent}66`,
                    paddingLeft: 10
                  }}
                >
                  {b.slice(0, 420)}
                  {b.length > 420 ? "…" : ""}
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="mt-6 retro-panel p-5">
          <div className="retro-label">talk to {name}'s twin</div>
          <p
            className="mt-2 text-sm"
            style={{ color: "var(--text-dim)" }}
          >
            Your twin can talk to theirs in the background to surface the
            highest-leverage overlap before either of you spends a minute
            on a call.
          </p>
          <Link
            href={isOwner ? "/dashboard" : `/login?next=/u/${handle}`}
            className="retro-btn retro-btn-primary mt-3 inline-block"
          >
            {isOwner
              ? "open dashboard"
              : `+ start a conversation with ${name.split(/\s+/)[0]}`}
          </Link>
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
    </main>
  );
}
