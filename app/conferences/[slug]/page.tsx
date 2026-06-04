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
import { NetworkDensityCompare } from "../../communities/NetworkDensityCompare";
import { HostBriefEditor } from "./HostBriefEditor";
import { MemberCard } from "./MemberCard";
import { BannerUpload } from "./BannerUpload";
import { socialsFromBlob } from "@/lib/social-from-blob";

/**
 * Derive the "Tip of their self iceberg" framework (Jack) from a member's
 * twin: about / wants-needs / offers. Heuristic + fast (no LLM) so the
 * page stays snappy even with many members. Each field degrades to null
 * when there's no signal, and the card hides empty rows.
 */
function deriveIceberg(src: {
  portfolio_about: string | null;
  goals: string | null;
  deal_preferences: string | null;
  ai_export_blob: string | null;
}): { about: string | null; wants: string | null; offers: string | null } {
  const clean = (s: string | null | undefined, max = 320): string | null => {
    const t = (s ?? "").toString().replace(/\s+/g, " ").trim();
    if (t.length < 3) return null;
    return t.length > max ? `${t.slice(0, max).trim()}…` : t;
  };
  // Pull a labeled section out of the structured AI-export blob (the
  // onboarding prompt produces headed sections like "WHAT I HAVE THAT I
  // CAN GIVE"). Returns the first paragraph under any matching heading.
  const section = (blob: string | null, kw: RegExp): string | null => {
    if (!blob) return null;
    const lines = blob.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      if (kw.test(lines[i])) {
        const body: string[] = [];
        for (let j = i + 1; j < lines.length && body.length < 4; j++) {
          const l = lines[j].trim();
          if (!l) {
            if (body.length) break;
            continue;
          }
          if (/^#{1,6}\s|^\d+\.\s|^[A-Z][A-Z \-/]{6,}$/.test(l)) break; // next heading
          body.push(l.replace(/^[-*•]\s*/, ""));
        }
        const joined = body.join(" ").trim();
        if (joined.length > 8) return joined;
      }
    }
    return null;
  };
  const about =
    clean(src.portfolio_about) ||
    clean(src.goals, 220) ||
    clean(section(src.ai_export_blob, /working on|about me|who i am/i), 220);
  const wants =
    clean(src.deal_preferences, 220) ||
    clean(
      section(
        src.ai_export_blob,
        /intros|looking for|want to meet|needle|need/i
      ),
      220
    );
  const offers = clean(
    section(src.ai_export_blob, /can give|i can offer|what i have|offer/i),
    220
  );
  return { about, wants, offers };
}

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

  // PUBLIC member list — id + name + avatar + goals + portfolio_about
  // + handle. Loaded for EVERY visitor so the "already in the room"
  // preview reads as a full summary instead of just a name. Jack: "THIS
  // SHOULD HAVE A FULL SUMMARY OF ME." Goals are the high-level "what
  // I'm working toward" line already shown on the public /u/[handle]
  // portfolio page, so leaking it here adds no new exposure.
  type PublicMember = {
    id: string;
    display_name: string | null;
    email: string | null;
    avatar_url: string | null;
    goals: string | null;
    portfolio_about: string | null;
    handle: string | null;
    // Iceberg framework (Jack): about / wants-needs / offers derived from
    // the member's twin so each card reads as a real person, not a name.
    about: string | null;
    wants: string | null;
    offers: string | null;
    socials: ReturnType<typeof socialsFromBlob>;
  };
  let publicMembers: PublicMember[] = [];
  // Full directory (still gated on isMember) — reuses publicMembers
  // for now since goals is already in the public payload. Kept as a
  // separate ref so the bottom "attendees · N" directory keeps reading
  // a logged-in-only data source.
  let members: PublicMember[] | null = null;

  {
    const { data: memberRows } = await service
      .from("conference_members")
      .select("user_id")
      .eq("conference_slug", slug);
    const ids = (memberRows ?? []).map((r) => r.user_id);
    if (ids.length > 0) {
      // Profiles + portfolio_about + handle. Wrap in try so missing
      // columns on prod don't blank the page.
      let profs: any[] = [];
      try {
        const { data } = await service
          .from("profiles")
          .select(
            "id, display_name, email, avatar_url, handle, portfolio_about, linkedin_url, x_url, instagram_url, facebook_url, website_url"
          )
          .in("id", ids);
        profs = data ?? [];
      } catch {
        const { data } = await service
          .from("profiles")
          .select("id, display_name, email, avatar_url")
          .in("id", ids);
        profs = data ?? [];
      }
      let twins: any[] = [];
      try {
        const { data } = await service
          .from("twin_profiles")
          .select("user_id, goals, deal_preferences, ai_export_blob")
          .in("user_id", ids);
        twins = data ?? [];
      } catch {
        const { data } = await service
          .from("twin_profiles")
          .select("user_id, goals")
          .in("user_id", ids);
        twins = data ?? [];
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

  // OTHER COMMUNITIES BY THIS HOST — surfaces at the page bottom so a
  // visitor who connects with the host's ecosystem can jump straight
  // into the next room. Jack: "on communities page bottom show any
  // communities that person created."
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

  // Owner profile (lookup so we can render "hosted by ..." nicely)
  const { data: ownerProfile } = await service
    .from("profiles")
    .select("display_name, email, avatar_url, portfolio_about")
    .eq("id", conf.owner_user_id)
    .maybeSingle();
  const ownerName =
    ownerProfile?.display_name || ownerProfile?.email || "the host";
  // Host brief (#15): a per-room override (conferences.host_brief, may be
  // absent pre-migration since the row is selected with `*`) falls back to
  // the host's global profile brief. Shown on the host card; editable by
  // the owner with a global-vs-this-room scope choice.
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
  // Communities and conferences share this page (next.config rewrites
  // /communities/:slug → /conferences/:slug) — but the URL the user
  // sees + shares should match the row's `kind`. Pick the prefix here
  // and reuse it everywhere a URL is constructed below.
  const kind = ((conf as any).kind || "conference") as
    | "conference"
    | "community";
  const urlPrefix = kind === "community" ? "/communities" : "/conferences";
  const kindLabel = kind === "community" ? "community" : "conference";
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
    <main className="max-w-5xl mx-auto px-6 pt-3 pb-8">
      {/* Reset scroll when the page is reached via ?created=1 from the
          new-conference / new-community redirect. Browser scroll-
          restoration was dropping users at the bottom of the page on
          load — what Jack hit after clicking "make conference". */}
      <ScrollTopOnFlag flags={["created", "saved"]} />
      <div className="flex items-center justify-between">
        <Wordmark />
        <div className="flex items-center gap-4 text-sm">
          <Link href="/dashboard" className="retro-dim hover:text-white">
            dashboard
          </Link>
          {isOwner && (
            <Link
              href={`${urlPrefix}/${slug}/edit`}
              className="retro-dim hover:text-white"
            >
              edit
            </Link>
          )}
        </div>
      </div>

      {searchParams.created === "1" && (
        <p className="mt-4 retro-green text-sm">
          ✓ {kindLabel.charAt(0).toUpperCase() + kindLabel.slice(1)} created.
          Share the link below — anyone who joins through it becomes a
          member of {conf.name}.
        </p>
      )}

      {/* BANNER — creator-uploaded cover image (also the OG/share image).
          Full-bleed within the page column; owner gets the upload control
          beneath it. */}
      {(conf as any).cover_url && (
        <div
          style={{
            marginTop: 20,
            borderRadius: 18,
            overflow: "hidden",
            border: "1px solid var(--border)",
            aspectRatio: "1200 / 400"
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
        <BannerUpload
          slug={conf.slug}
          initialUrl={(conf as any).cover_url ?? null}
        />
      )}

      {/* HERO */}
      <section className="mt-8 grid lg:grid-cols-[1fr_240px] gap-8 items-start">
        <div className="min-w-0">
          <div className="retro-label">{kindLabel}</div>
          {/* #156 — custom branding: when the host pasted a website URL,
              show the scraped logo + brand-color accent bar so the room
              feels like theirs, not generic SyncedIn chrome. */}
          <div className="flex items-center gap-3 mt-3">
            {conf.logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={conf.logo_url}
                alt={`${conf.name} logo`}
                width={56}
                height={56}
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 10,
                  objectFit: "cover",
                  border: "1px solid var(--border)",
                  flex: "0 0 auto"
                }}
              />
            )}
            <h1 className="retro-h1 text-4xl leading-tight min-w-0">
              {conf.name}
            </h1>
          </div>
          {conf.brand_color && (
            <div
              aria-hidden
              style={{
                height: 3,
                width: 80,
                borderRadius: 999,
                background: conf.brand_color,
                marginTop: 10
              }}
            />
          )}
          <div
            className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm"
            style={{ color: "var(--text-dim)" }}
          >
            {dateLine && <span>📅 {dateLine}</span>}
            {conf.city && <span>📍 {conf.city}</span>}
            <span>
              hosted by{" "}
              <span style={{ color: "var(--text)" }}>{ownerName}</span>
            </span>
          </div>
          {conf.description && (
            <p className="mt-4 text-base leading-relaxed">{conf.description}</p>
          )}

          {/* STATS — relabeled per Jack: "let's not call it attendee
              lets call it signs up so far." Same number; clearer for
              both community + conference contexts since neither is an
              event until people actually sign up. */}
          <div className="mt-5 grid grid-cols-3 gap-2 max-w-md">
            <Stat
              n={attendeeCount ?? 0}
              label="signed up so far"
              accent="var(--amber-bright)"
            />
            <Stat
              n={Math.max(0, (attendeeCount ?? 1) * ((attendeeCount ?? 1) - 1)) / 2}
              label="possible pairings"
              accent="var(--text-dim)"
            />
            <Stat
              n={isMember ? "in" : isOwner ? "host" : "—"}
              label="your status"
              accent={
                isOwner
                  ? "var(--amber-bright)"
                  : isMember
                  ? "var(--green)"
                  : "var(--text-dim)"
              }
            />
          </div>
        </div>

        {/* QR for in-person check-in (visible to everyone — shareable) */}
        <div
          className="retro-panel"
          style={{ padding: 12, display: "grid", placeItems: "center" }}
        >
          <img
            src={qrUrl}
            alt={`QR code to join ${conf.name}`}
            width={200}
            height={200}
            style={{ borderRadius: 6, display: "block" }}
          />
          <div
            className="retro-dim text-[10px] mt-2 text-center"
            style={{ letterSpacing: "0.08em", textTransform: "uppercase" }}
          >
            scan to join
          </div>
        </div>
      </section>

      {/* SHARE URL */}
      <div className="mt-8">
        <ShareUrlBox url={joinUrl} conferenceName={conf.name} />
      </div>

      {/* PUBLIC MEMBER PREVIEW — full summary cards (avatar + name +
          host badge + goals line + portfolio link). Visible to EVERY
          visitor including external ones. Owner pinned first. Jack:
          "THIS SHOULD HAVE A FULL SUMMARY OF ME." */}
      {(() => {
        const base = publicMembers.length > 0
          ? publicMembers.slice(0, 6)
          : (ownerProfile
              ? [
                  {
                    id: conf.owner_user_id,
                    display_name:
                      (ownerProfile as any).display_name ?? null,
                    email: (ownerProfile as any).email ?? null,
                    avatar_url: (ownerProfile as any).avatar_url ?? null,
                    goals: null,
                    portfolio_about: null,
                    handle: null
                  } as any
                ]
              : []);
        const preview = base;
        if (preview.length === 0) return null;
        const sorted = [
          ...preview.filter((m) => m.id === conf.owner_user_id),
          ...preview.filter((m) => m.id !== conf.owner_user_id)
        ];
        return (
          <section className="mt-8">
            <div className="retro-label">already in the room</div>
            <p
              className="text-xs mt-1"
              style={{ color: "var(--text-dim)" }}
            >
              Public preview of the first {sorted.length} member
              {sorted.length === 1 ? "" : "s"}. Sign up to see everyone
              and start a twin conversation with anyone here.
            </p>
            <div
              className="mt-3"
              style={{
                display: "grid",
                gap: 12,
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(280px, 1fr))"
              }}
            >
              {sorted.map((m) => {
                const isHost = m.id === conf.owner_user_id;
                const name = m.display_name ?? m.email ?? "Member";
                // Owner editing their OWN card keeps the inline brief
                // editor (global-vs-this-room scope, #15).
                if (isHost && isOwner) {
                  return (
                    <div
                      key={m.id}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 10,
                        padding: 16,
                        borderRadius: 14,
                        background: "var(--panel-solid)",
                        border: "1px solid var(--amber)"
                      }}
                    >
                      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                        <Avatar id={m.id} name={name} avatarUrl={m.avatar_url} size={44} />
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontWeight: 800, fontSize: 15, color: "var(--text)" }}>
                            {name}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
                            <span
                              style={{
                                fontSize: 9,
                                fontWeight: 800,
                                letterSpacing: "0.12em",
                                textTransform: "uppercase",
                                color: "var(--amber-bright)"
                              }}
                            >
                              host
                            </span>
                            {(m as any).socials && (
                              <SocialIconRow urls={(m as any).socials} size={13} gap={4} />
                            )}
                          </div>
                        </div>
                      </div>
                      <HostBriefEditor slug={conf.slug} initialBrief={resolvedHostBrief} />
                    </div>
                  );
                }
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
      })()}

      {/* NETWORK DENSITY COMPARE — side-by-side "today (scattered
          dots) vs. on SyncedIn (fully-connected polygon with real
          member avatars)". Visible to EVERY visitor including
          external ones so the "why join" lands immediately. */}
      <NetworkDensityCompare
        members={publicMembers}
        totalCount={attendeeCount ?? 0}
        kindLabel={kindLabel}
      />

      {/* CTAs based on viewer state — moved BELOW the value blocks
          (preview + density) per Jack: "lets move the already in the
          room and the density compounds forever block above BROADCAST
          AND INVITE PART FOCUS ON VALUE TO THE USER." Visitors see
          why-join first, then the join button. */}
      {!user && (
        <section className="mt-8 retro-panel p-6">
          <div className="retro-label">join {conf.name}</div>
          <p
            className="mt-2 text-base"
            style={{ color: "var(--text-dim)" }}
          >
            Sign up below. You&apos;ll only see and be seen by other{" "}
            {kind === "community" ? "members" : "attendees"} of this{" "}
            {kindLabel}.
          </p>
          <Link
            href={`/login?${kind}=${slug}`}
            className="retro-btn retro-btn-primary mt-4 inline-block"
          >
            + Sign up &amp; join
          </Link>
        </section>
      )}

      {user && !isMember && !isOwner && (
        <section className="mt-8 retro-panel p-6">
          <p className="text-base">
            You&apos;re signed in but not a member of this {kindLabel} yet.
          </p>
          <Link
            href={`${urlPrefix}/${slug}/join`}
            className="retro-btn retro-btn-primary mt-4 inline-block"
          >
            + Join {conf.name}
          </Link>
        </section>
      )}

      {/* OWNER toolkit — the broadcast/invite block. Moved below the
          value blocks too so the host's own page also leads with the
          room's social proof, not the outbound tool. */}
      {isOwner && (
        <section className="mt-8">
          <div className="retro-label" style={{ color: "var(--amber-bright)" }}>
            host toolkit
          </div>
          <h2
            className="retro-h1 mt-1"
            style={{
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: "-0.01em",
              lineHeight: 1.2
            }}
          >
            Have your twin talk to anyone else&apos;s
            <br className="hidden sm:inline" /> based on their public
            profiles + make custom invites.
          </h2>
          <p
            className="text-sm mt-2"
            style={{ color: "var(--text-dim)", maxWidth: 620 }}
          >
            Paste a LinkedIn, X, Instagram, or any URL. We&apos;ll
            scrape it into a ghost twin, simulate the conversation, and
            ship a personalized landing page so when they click they
            already see what a deal between you would look like. Every
            invite carries the {conf.name} {kindLabel} tag.
          </p>
          <div className="mt-4">
            <BulkReachToolkit appUrl={joinUrl} variant="card" />
          </div>
        </section>
      )}

      {/* ATTENDEE DIRECTORY (members only) */}
      {isMember && members && (
        <section className="mt-4">
          <div className="retro-label">attendees · {members.length}</div>
          <p className="mt-1 retro-dim text-xs">
            Only members of {conf.name} can see and connect with each other
            here. Start a twin conversation with anyone in the room.
          </p>
          <div className="mt-4 grid sm:grid-cols-2 gap-3">
            {members
              .filter((m) => user && m.id !== user.id)
              .map((m) => (
                <form
                  key={m.id}
                  action={startConversationWithUser}
                  className="retro-panel retro-panel-hover p-3 flex items-start gap-3"
                >
                  <input type="hidden" name="userId" value={m.id} />
                  <Avatar
                    id={m.id}
                    name={m.display_name ?? m.email ?? "Member"}
                    avatarUrl={m.avatar_url}
                    size={40}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm">
                      {m.display_name ?? m.email}
                    </div>
                    {m.goals && (
                      <div className="retro-dim text-xs mt-1 line-clamp-2">
                        {m.goals}
                      </div>
                    )}
                  </div>
                  <button
                    type="submit"
                    className="retro-btn retro-btn-primary text-xs shrink-0"
                  >
                    + connect
                  </button>
                </form>
              ))}
          </div>
          {members.filter((m) => user && m.id !== user.id).length === 0 && (
            <p className="mt-4 retro-dim text-sm">
              No one else here yet. Share the link above — once people join,
              your twin can start finding win-wins inside the room.
            </p>
          )}
        </section>
      )}

      {/* OTHER COMMUNITIES BY THIS HOST — surfaces other rooms the
          owner has spun up so a visitor who likes this one can jump
          straight into the next. Jack: "on communities page bottom
          show any communities that person created." */}
      {otherByHost.length > 0 && (
        <section className="mt-10">
          <div className="retro-label">
            more from {ownerName}
          </div>
          <p
            className="text-xs mt-1"
            style={{ color: "var(--text-dim)" }}
          >
            Other {otherByHost.length === 1 ? "room" : "rooms"}{" "}
            {ownerName} hosts on SyncedIn.
          </p>
          <div
            className="mt-3"
            style={{
              display: "grid",
              gap: 10,
              gridTemplateColumns:
                "repeat(auto-fit, minmax(220px, 1fr))"
            }}
          >
            {otherByHost.map((o) => {
              const prefix =
                o.kind === "community" ? "/communities" : "/conferences";
              const tag = o.kind === "community" ? "community" : "conference";
              return (
                <Link
                  key={o.slug}
                  href={`${prefix}/${o.slug}`}
                  className="retro-panel retro-panel-hover"
                  style={{
                    padding: 14,
                    textDecoration: "none",
                    display: "flex",
                    flexDirection: "column",
                    gap: 6
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      color: "var(--text-dim)"
                    }}
                  >
                    {tag}
                  </div>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 700,
                      color: "var(--text)"
                    }}
                  >
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

function Stat({
  n,
  label,
  accent
}: {
  n: number | string;
  label: string;
  accent: string;
}) {
  return (
    <div
      className="retro-panel"
      style={{ padding: "10px 12px", textAlign: "center" }}
    >
      <div
        style={{
          fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
          fontSize: 22,
          fontWeight: 700,
          color: accent,
          lineHeight: 1.1
        }}
      >
        {typeof n === "number" ? Math.round(n).toLocaleString() : n}
      </div>
      <div
        className="retro-dim text-[10px] mt-1"
        style={{ letterSpacing: "0.08em", textTransform: "uppercase" }}
      >
        {label}
      </div>
    </div>
  );
}
