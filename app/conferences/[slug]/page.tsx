import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { Wordmark } from "../../Wordmark";
import { Avatar } from "../../Avatar";
import { SocialIconRow } from "../../SocialIconRow";
import { startConversationWithUser } from "../../dashboard/actions";
import { BulkReachToolkit } from "../../BulkReachToolkit";
import { ShareUrlBox } from "./ShareUrlBox";
import { ScrollTopOnFlag } from "../../ScrollTopOnFlag";
import { HostBriefEditor } from "./HostBriefEditor";
import { MemberCard } from "./MemberCard";
import { BannerUpload } from "./BannerUpload";
import { GroupLimitControl } from "./GroupLimitControl";
import { QuickJoinForm } from "./QuickJoinForm";
import { MemberAdminControls } from "./MemberAdminControls";
import { OgPreviewControl } from "./OgPreviewControl";
import { socialsFromBlob } from "@/lib/social-from-blob";
import { deriveIceberg } from "@/lib/iceberg";
import { TopMatches } from "./TopMatches";
import { RoomWorkflowGuide } from "./RoomWorkflowGuide";

// Render fresh every request — without this the page is statically
// cached, so a newly uploaded banner / freshly joined members don't show
// up until a redeploy.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({
  params
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const slug = (params.slug || "").toLowerCase();
  if (!slug) return {};
  const service = createServiceClient();
  const { data: conf } = await service
    .from("conferences")
    .select("name, description, city")
    .eq("slug", slug)
    .maybeSingle();
  if (!conf) return {};
  const title = `${conf.name} · SyncedIn`;
  const description =
    conf.description ||
    `Inside-only twin networking for ${conf.name}. Your clone finds the highest win-wins among everyone in the room.`;
  return {
    title,
    description,
    openGraph: { title, description, type: "website" },
    twitter: { card: "summary_large_image", title, description }
  };
}

export default async function ConferencePage({
  params,
  searchParams
}: {
  params: { slug: string };
  searchParams: { created?: string };
}) {
  const slug = (params.slug || "").toLowerCase();
  if (!slug) notFound();

  const service = createServiceClient();
  const { data: conf } = await service
    .from("conferences")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (!conf) notFound();

  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  const isOwner = !!(user && user.id === conf.owner_user_id);

  // Member check + counts via the service client to avoid RLS surprises.
  let isMember = isOwner;
  if (user && !isOwner) {
    const { data: m } = await service
      .from("conference_members")
      .select("user_id")
      .eq("conference_slug", slug)
      .eq("user_id", user.id)
      .maybeSingle();
    isMember = !!m;
  }

  // Aggregate stats — visible to everyone (just counts, no PII).
  const { count: attendeeCount } = await service
    .from("conference_members")
    .select("user_id", { count: "exact", head: true })
    .eq("conference_slug", slug);

  // PUBLIC member list — loaded for directory & previews.
  type PublicMember = {
    id: string;
    display_name: string | null;
    email: string | null;
    avatar_url: string | null;
    goals: string | null;
    portfolio_about: string | null;
    handle: string | null;
    about: string | null;
    wants: string | null;
    offers: string | null;
    socials: ReturnType<typeof socialsFromBlob>;
  };
  let publicMembers: PublicMember[] = [];
  let members: PublicMember[] | null = null;

  {
    const { data: memberRows } = await service
      .from("conference_members")
      .select("user_id")
      .eq("conference_slug", slug);
    const ids = (memberRows ?? []).map((r) => r.user_id);
    if (ids.length > 0) {
      let profs: any[] = [];
      {
        const full = await service
          .from("profiles")
          .select(
            "id, display_name, email, avatar_url, handle, portfolio_about, linkedin_url, x_url, instagram_url, facebook_url, website_url"
          )
          .in("id", ids);
        if (!full.error && full.data) {
          profs = full.data;
        } else {
          const mid = await service
            .from("profiles")
            .select("id, display_name, email, avatar_url, handle, portfolio_about")
            .in("id", ids);
          if (!mid.error && mid.data) {
            profs = mid.data;
          } else {
            const basic = await service
              .from("profiles")
              .select("id, display_name, email, avatar_url")
              .in("id", ids);
            profs = basic.data ?? [];
          }
        }
      }
      let twins: any[] = [];
      {
        const full = await service
          .from("twin_profiles")
          .select("user_id, goals, deal_preferences, ai_export_blob")
          .in("user_id", ids);
        if (!full.error && full.data) {
          twins = full.data;
        } else {
          const basic = await service
            .from("twin_profiles")
            .select("user_id, goals")
            .in("user_id", ids);
          twins = basic.data ?? [];
        }
      }
      const twinById = new Map(
        (twins ?? []).map((t: any) => [t.user_id, t])
      );
      publicMembers = profs.map((p: any) => {
        const t = twinById.get(p.id) ?? {};
        const goals = (t.goals as string | null) ?? null;
        const dealPrefs = (t.deal_preferences as string | null) ?? null;
        const blob = (t.ai_export_blob as string | null) ?? null;
        const iceberg = deriveIceberg({
          portfolio_about: p.portfolio_about ?? null,
          goals,
          deal_preferences: dealPrefs,
          ai_export_blob: blob
        });
        return {
          id: p.id,
          display_name: p.display_name,
          email: p.email,
          avatar_url: p.avatar_url ?? null,
          goals,
          portfolio_about: p.portfolio_about ?? null,
          handle: p.handle ?? null,
          about: iceberg.about,
          wants: iceberg.wants,
          offers: iceberg.offers,
          socials: socialsFromBlob(p, {
            ai_export_blob: blob,
            goals,
            deal_preferences: dealPrefs
          })
        };
      });
      if (isMember) members = publicMembers;
    }
  }

  // OTHER COMMUNITIES BY THIS HOST
  let otherByHost: { slug: string; name: string; kind: string }[] = [];
  try {
    const { data: others } = await service
      .from("conferences")
      .select("slug, name, kind")
      .eq("owner_user_id", conf.owner_user_id)
      .neq("slug", slug)
      .order("created_at", { ascending: false })
      .limit(8);
    otherByHost = (others ?? []) as any[];
  } catch {
    /* table may not exist on this DB; skip silently */
  }

  // Owner profile
  let ownerProfile:
    | {
        display_name: string | null;
        email: string | null;
        avatar_url: string | null;
        portfolio_about?: string | null;
      }
    | null = null;
  {
    const full = await service
      .from("profiles")
      .select("display_name, email, avatar_url, portfolio_about")
      .eq("id", conf.owner_user_id)
      .maybeSingle();
    if (!full.error && full.data) {
      ownerProfile = full.data as any;
    } else {
      const basic = await service
        .from("profiles")
        .select("display_name, email, avatar_url")
        .eq("id", conf.owner_user_id)
        .maybeSingle();
      ownerProfile = (basic.data as any) ?? null;
    }
  }
  const ownerName =
    ownerProfile?.display_name || ownerProfile?.email || "the host";

  const resolvedHostBrief = (
    (conf as any).host_brief ??
    (ownerProfile as any)?.portfolio_about ??
    ""
  )
    .toString()
    .trim();

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "https://syncedin.org";

  const kind = ((conf as any).kind || "conference") as
    | "conference"
    | "community";
  const urlPrefix = kind === "community" ? "/communities" : "/conferences";
  const kindLabel = kind === "community" ? "community" : "conference";

  const memberLimit: number | null = (() => {
    const m = (conf as any).brand_meta?.member_limit;
    return typeof m === "number" && m > 0 ? m : null;
  })();

  const joinUrl = `${appUrl}${urlPrefix}/${slug}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(
    joinUrl
  )}`;

  // Date helpers
  const start = conf.starts_at ? new Date(conf.starts_at) : null;
  const end = conf.ends_at ? new Date(conf.ends_at) : null;
  const dateLine = (() => {
    if (start && end) {
      const sameYear = start.getFullYear() === end.getFullYear();
      const opts: Intl.DateTimeFormatOptions = sameYear
        ? { month: "short", day: "numeric" }
        : { year: "numeric", month: "short", day: "numeric" };
      return `${start.toLocaleDateString(undefined, opts)} – ${end.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}`;
    }
    if (start)
      return start.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric"
      });
    return null;
  })();

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-3 pb-12">
      <ScrollTopOnFlag flags={["created", "saved"]} />

      {/* TOP NAV BAR */}
      <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: "var(--border)" }}>
        <Wordmark />
        <div className="flex items-center gap-4 text-xs sm:text-sm">
          <Link
            href="/dashboard"
            className="retro-btn text-xs py-1 px-3 inline-flex items-center gap-1"
          >
            ← Dashboard
          </Link>
          {isOwner && (
            <Link
              href={`${urlPrefix}/${slug}/edit`}
              className="retro-btn text-xs py-1 px-2.5"
            >
              edit room
            </Link>
          )}
        </div>
      </div>

      {searchParams.created === "1" && (
        <div
          className="mt-4 p-3 rounded-lg flex items-center justify-between text-xs sm:text-sm font-semibold"
          style={{ background: "var(--panel-2)", border: "1px solid var(--green)", color: "var(--green)" }}
        >
          <span>✓ {kindLabel.charAt(0).toUpperCase() + kindLabel.slice(1)} created. Members who join through the link will appear here.</span>
        </div>
      )}

      {/* BANNER (creator-uploaded cover) */}
      {(conf as any).cover_url && (
        <div
          style={{
            marginTop: 18,
            borderRadius: "var(--radius)",
            overflow: "hidden",
            border: "1px solid var(--border)",
            aspectRatio: "1200 / 380"
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={(conf as any).cover_url}
            alt={`${conf.name} banner`}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        </div>
      )}
      {isOwner && (
        <div className="mt-2">
          <BannerUpload
            slug={conf.slug}
            initialUrl={(conf as any).cover_url ?? null}
          />
        </div>
      )}

      {/* ROOM HERO META SECTION */}
      <section className="mt-6 mb-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span
                className="retro-label uppercase px-2 py-0.5 rounded text-[10px]"
                style={{ background: "var(--panel-2)", color: "var(--amber-bright)" }}
              >
                {kindLabel}
              </span>
              {conf.city && (
                <span className="text-xs font-mono" style={{ color: "var(--text-dim)" }}>
                  📍 {conf.city}
                </span>
              )}
              {dateLine && (
                <span className="text-xs font-mono" style={{ color: "var(--text-dim)" }}>
                  📅 {dateLine}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              {conf.logo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={conf.logo_url}
                  alt={`${conf.name} logo`}
                  width={52}
                  height={52}
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 10,
                    objectFit: "cover",
                    border: "1px solid var(--border)",
                    flex: "0 0 auto"
                  }}
                />
              )}
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--text)]">
                {conf.name}
              </h1>
            </div>

            {conf.brand_color && (
              <div
                aria-hidden
                style={{
                  height: 3,
                  width: 64,
                  borderRadius: 999,
                  background: conf.brand_color,
                  marginTop: 8
                }}
              />
            )}

            <div className="mt-2 text-xs sm:text-sm" style={{ color: "var(--text-dim)" }}>
              Hosted by <span style={{ color: "var(--text)", fontWeight: 600 }}>{ownerName}</span>
              {conf.description && <span className="mx-2">·</span>}
              {conf.description && <span>{conf.description}</span>}
            </div>
          </div>

          {/* Quick Stat / Room Cap */}
          <div className="flex items-center gap-3 shrink-0">
            <div
              className="retro-panel px-4 py-2 text-center"
              style={{ borderRadius: "var(--radius)", background: "var(--panel-2)" }}
            >
              <div className="font-mono text-xl sm:text-2xl font-extrabold text-[var(--amber-bright)] leading-tight">
                {attendeeCount ?? 0}
              </div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-dim)]">
                {attendeeCount === 1 ? "Member" : "Members"} in Room
              </div>
            </div>

            {memberLimit && (
              <div
                className="retro-panel px-4 py-2 text-center"
                style={{ borderRadius: "var(--radius)", background: "var(--panel-2)" }}
              >
                <div className="font-mono text-xl sm:text-2xl font-extrabold text-[var(--green)] leading-tight">
                  {Math.max(0, memberLimit - (attendeeCount ?? 0))}
                </div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-dim)]">
                  Spots Left
                </div>
              </div>
            )}
          </div>
        </div>

        {isOwner && memberLimit !== null && (
          <div className="mt-2 text-xs">
            <GroupLimitControl slug={conf.slug} initialLimit={memberLimit} />
          </div>
        )}
      </section>

      {/* ========================================================================= */}
      {/* 1. PRIMARY HERO EXPERIENCE: TOP MATCHES (Members Only) */}
      {/* ========================================================================= */}
      {isMember && <TopMatches conferenceSlug={conf.slug} />}

      {/* ========================================================================= */}
      {/* 2. NON-MEMBER EXPERIENCE: INSTANT CONVERSION HERO */}
      {/* ========================================================================= */}
      {!user && (
        <section
          className="retro-panel p-6 sm:p-8 mb-10"
          style={{
            border: "1px solid var(--border-bright)",
            boxShadow: "0 8px 30px -10px var(--accent-glow)",
            borderRadius: "var(--radius)"
          }}
        >
          <div className="max-w-2xl">
            <div className="retro-label mb-2" style={{ color: "var(--amber-bright)" }}>
              🎯 Instant AI Matching
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--text)] mb-2">
              Discover your top collaboration matches in {conf.name}
            </h2>
            <p className="text-xs sm:text-sm text-[var(--text-dim)] mb-6 leading-relaxed">
              Your digital twin compares your background and goals with everyone in this room using 768-dimensional AI embeddings to surface high-reward connections.
            </p>
          </div>
          <QuickJoinForm
            slug={slug}
            signupHref={`/login?${kind}=${slug}`}
            roomName={conf.name}
          />
        </section>
      )}

      {user && !isMember && !isOwner && (
        <section
          className="retro-panel p-6 sm:p-8 mb-10 text-center"
          style={{
            border: "1px solid var(--border-bright)",
            boxShadow: "0 8px 30px -10px var(--accent-glow)",
            borderRadius: "var(--radius)"
          }}
        >
          <div className="max-w-xl mx-auto">
            <div className="retro-label mb-2" style={{ color: "var(--amber-bright)" }}>
              🎯 Unlock Room Radar
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--text)] mb-2">
              Join {conf.name} to see your top matches
            </h2>
            <p className="text-xs sm:text-sm text-[var(--text-dim)] mb-6">
              You&apos;re signed in! Join this {kindLabel} to rank your highest-synergy pairings with all {attendeeCount ?? 0} members.
            </p>
            <Link
              href={`${urlPrefix}/${slug}/join`}
              className="retro-btn retro-btn-primary text-sm font-bold py-3 px-6 inline-flex items-center gap-2"
            >
              + Join {conf.name} Now
            </Link>
          </div>
        </section>
      )}

      {/* ROOM WORKFLOW GUIDE (Clean, collapsible guide explaining how to use the page) */}
      <RoomWorkflowGuide roomName={conf.name} kindLabel={kindLabel} />

      {/* ========================================================================= */}
      {/* 3. ATTENDEE DIRECTORY / MEMBER CARDS */}
      {/* ========================================================================= */}
      {isMember && members && (
        <section className="mb-12">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
            <div>
              <div className="retro-label" style={{ fontSize: 11 }}>
                Room Directory · {members.length} {members.length === 1 ? "member" : "members"}
              </div>
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-[var(--text)] mt-0.5">
                All Members in {conf.name}
              </h2>
            </div>
            <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--text-dim)]">
              Verified Attendees
            </span>
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {members
              .filter((m) => user && m.id !== user.id)
              .map((m) => (
                <form
                  key={m.id}
                  action={startConversationWithUser}
                  className="retro-panel retro-panel-hover p-4 flex flex-col justify-between gap-3.5"
                  style={{ borderRadius: "var(--radius)", background: "var(--panel-solid)" }}
                >
                  <input type="hidden" name="userId" value={m.id} />
                  <div className="flex items-start gap-3">
                    <Avatar
                      id={m.id}
                      name={m.display_name ?? m.email ?? "Member"}
                      avatarUrl={m.avatar_url}
                      size={44}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-sm text-[var(--text)] truncate">
                        {m.display_name ?? m.email}
                      </div>
                      {m.goals ? (
                        <div
                          className="text-xs mt-1 line-clamp-2 leading-relaxed"
                          style={{ color: "var(--text-dim)" }}
                        >
                          {m.goals}
                        </div>
                      ) : (
                        <div
                          className="text-xs mt-1 italic"
                          style={{ color: "var(--text-dim)" }}
                        >
                          Active room attendee
                        </div>
                      )}
                    </div>
                  </div>

                  <div
                    className="pt-2.5 border-t flex items-center justify-between gap-2"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <span
                      className="text-[10px] font-mono font-bold uppercase tracking-wider"
                      style={{ color: "var(--text-dim)" }}
                    >
                      Room Member
                    </span>
                    <div className="flex items-center gap-2">
                      {isOwner && (
                        <MemberAdminControls
                          slug={conf.slug}
                          userId={m.id}
                          name={m.display_name ?? m.email ?? "this member"}
                        />
                      )}
                      <button
                        type="submit"
                        className="retro-btn retro-btn-primary text-xs font-semibold px-3.5 py-1.5 flex items-center gap-1 cursor-pointer"
                      >
                        + connect
                      </button>
                    </div>
                  </div>
                </form>
              ))}
          </div>
          {members.filter((m) => user && m.id !== user.id).length === 0 && (
            <div
              className="retro-panel p-6 mt-4 text-center text-sm"
              style={{ color: "var(--text-dim)", borderRadius: "var(--radius)" }}
            >
              No other members here yet. Share the invite link below to start populating your room.
            </div>
          )}
        </section>
      )}

      {/* PUBLIC PREVIEW CARDS (When visitor is not yet a member) */}
      {!isMember && (
        (() => {
          const base = publicMembers.length > 0
            ? publicMembers.slice(0, 6)
            : (ownerProfile
                ? [
                    {
                      id: conf.owner_user_id,
                      display_name: (ownerProfile as any).display_name ?? null,
                      email: (ownerProfile as any).email ?? null,
                      avatar_url: (ownerProfile as any).avatar_url ?? null,
                      goals: null,
                      portfolio_about: null,
                      handle: null
                    } as any
                  ]
                : []);
          if (base.length === 0) return null;
          const sorted = [
            ...base.filter((m) => m.id === conf.owner_user_id),
            ...base.filter((m) => m.id !== conf.owner_user_id)
          ];
          return (
            <section className="mb-12">
              <div className="flex items-center justify-between mb-2">
                <div className="retro-label">already in the room</div>
                <span className="text-xs text-[var(--text-dim)] font-mono">
                  Showing {sorted.length} of {attendeeCount ?? sorted.length}
                </span>
              </div>
              <p className="text-xs mb-4 text-[var(--text-dim)]">
                Join this {kindLabel} to reveal your full win-wins with each member.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {sorted.map((m) => {
                  const isHost = m.id === conf.owner_user_id;
                  const name = m.display_name ?? m.email ?? "Member";
                  return (
                    <MemberCard
                      key={m.id}
                      id={m.id}
                      name={name}
                      avatarUrl={m.avatar_url}
                      handle={(m as any).handle ?? null}
                      isHost={isHost}
                      about={
                        isHost
                          ? resolvedHostBrief || (m as any).about || null
                          : (m as any).about ?? null
                      }
                      wants={(m as any).wants ?? null}
                      offers={(m as any).offers ?? null}
                      socials={(m as any).socials ?? null}
                      viewerSignedIn={!!user}
                      isSelf={!!user && user.id === m.id}
                      signupHref={`/login?${kind}=${slug}`}
                    />
                  );
                })}
              </div>
            </section>
          );
        })()
      )}

      {/* ========================================================================= */}
      {/* 4. HOST TOOLKIT (If Owner) */}
      {/* ========================================================================= */}
      {isOwner && (
        <section className="mb-12 p-6 rounded-xl retro-panel" style={{ borderRadius: "var(--radius)" }}>
          <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
            <div className="retro-label" style={{ color: "var(--amber-bright)" }}>
              host toolkit &amp; outbound engine
            </div>
            <span className="text-xs font-mono text-[var(--text-dim)]">Owner Controls</span>
          </div>

          <h2 className="text-xl font-bold tracking-tight text-[var(--text)] mb-2">
            Grow &amp; Personalize {conf.name}
          </h2>
          <p className="text-xs sm:text-sm text-[var(--text-dim)] mb-6 max-w-2xl leading-relaxed">
            Generate custom invite links from any profile URL, customize your room brief, and configure share previews.
          </p>

          {/* Host editable brief */}
          <div className="mb-6 p-4 rounded-lg" style={{ background: "var(--panel-2)", border: "1px solid var(--border)" }}>
            <div className="text-[10px] font-mono uppercase font-bold text-[var(--text-dim)] mb-2">
              Host About Brief (Visible to room members)
            </div>
            <HostBriefEditor
              slug={conf.slug}
              initialBrief={resolvedHostBrief}
            />
          </div>

          <div className="mb-6">
            <OgPreviewControl
              slug={conf.slug}
              initialTemplate={String((conf as any).brand_meta?.og_template ?? "")}
              hasBanner={!!(conf as any).cover_url}
            />
          </div>

          <div>
            <BulkReachToolkit appUrl={joinUrl} variant="card" />
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* 5. INVITE & SHARE UTILITY (Secondary) */}
      {/* ========================================================================= */}
      <section className="mb-12">
        <div className="retro-label mb-2">invite &amp; share room</div>
        <div className="flex flex-col md:flex-row gap-4 items-stretch">
          <div className="flex-1 min-w-0">
            <ShareUrlBox url={joinUrl} conferenceName={conf.name} />
          </div>
          <Link
            href={`${urlPrefix}/${slug}/join`}
            prefetch={true}
            aria-label={`Join ${conf.name}`}
            className="retro-panel retro-panel-hover p-4 flex flex-col items-center justify-center shrink-0"
            style={{ textDecoration: "none", borderRadius: "var(--radius)" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrUrl}
              alt={`QR code to join ${conf.name}`}
              width={120}
              height={120}
              style={{ borderRadius: 6, display: "block" }}
            />
            <div
              className="retro-dim text-[10px] mt-2 font-mono uppercase tracking-wider text-center"
            >
              Scan / Share QR
            </div>
          </Link>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 6. MORE FROM THIS HOST */}
      {/* ========================================================================= */}
      {otherByHost.length > 0 && (
        <section className="mt-8 pt-6 border-t" style={{ borderColor: "var(--border)" }}>
          <div className="retro-label mb-1">more from {ownerName}</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mt-3">
            {otherByHost.map((o) => {
              const prefix = o.kind === "community" ? "/communities" : "/conferences";
              const tag = o.kind === "community" ? "community" : "conference";
              return (
                <Link
                  key={o.slug}
                  href={`${prefix}/${o.slug}`}
                  className="retro-panel retro-panel-hover p-3.5 flex flex-col justify-between gap-2"
                  style={{ textDecoration: "none", borderRadius: "var(--radius)" }}
                >
                  <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-dim)]">
                    {tag}
                  </div>
                  <div className="font-bold text-sm text-[var(--text)] truncate">
                    {o.name}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}
