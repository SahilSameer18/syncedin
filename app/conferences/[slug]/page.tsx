import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { Wordmark } from "../../Wordmark";
import { Avatar } from "../../Avatar";
import { startConversationWithUser } from "../../dashboard/actions";
import { BulkReachToolkit } from "../../BulkReachToolkit";
import { ShareUrlBox } from "./ShareUrlBox";
import { ScrollTopOnFlag } from "../../ScrollTopOnFlag";
import { NetworkDensityCompare } from "../../communities/NetworkDensityCompare";

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
          .select("id, display_name, email, avatar_url, handle, portfolio_about")
          .in("id", ids);
        profs = data ?? [];
      } catch {
        const { data } = await service
          .from("profiles")
          .select("id, display_name, email, avatar_url")
          .in("id", ids);
        profs = data ?? [];
      }
      const { data: twins } = await service
        .from("twin_profiles")
        .select("user_id, goals")
        .in("user_id", ids);
      const goalById = new Map(
        (twins ?? []).map((t: any) => [t.user_id, t.goals as string | null])
      );
      publicMembers = profs.map((p: any) => ({
        id: p.id,
        display_name: p.display_name,
        email: p.email,
        avatar_url: p.avatar_url ?? null,
        goals: goalById.get(p.id) ?? null,
        portfolio_about: p.portfolio_about ?? null,
        handle: p.handle ?? null
      }));
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
    .select("display_name, email, avatar_url")
    .eq("id", conf.owner_user_id)
    .maybeSingle();
  const ownerName =
    ownerProfile?.display_name || ownerProfile?.email || "the host";

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

      {/* HERO */}
      <section className="mt-8 grid lg:grid-cols-[1fr_240px] gap-8 items-start">
        <div className="min-w-0">
          <div className="retro-label">{kindLabel}</div>
          <h1 className="retro-h1 text-4xl mt-3 leading-tight">
            {conf.name}
          </h1>
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
                const summary =
                  ((m as any).portfolio_about ?? "").toString().trim() ||
                  ((m as any).goals ?? "").toString().trim();
                return (
                  <div
                    key={m.id}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                      padding: 14,
                      borderRadius: 14,
                      background: "var(--panel-solid)",
                      border: isHost
                        ? "1px solid var(--amber)"
                        : "1px solid var(--border)"
                    }}
                  >
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                      <Avatar
                        id={m.id}
                        name={name}
                        avatarUrl={m.avatar_url}
                        size={44}
                      />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: 14,
                            color: "var(--text)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap"
                          }}
                        >
                          {name}
                        </div>
                        {isHost && (
                          <div
                            style={{
                              fontSize: 9,
                              fontWeight: 800,
                              letterSpacing: "0.12em",
                              textTransform: "uppercase",
                              color: "var(--amber-bright)",
                              marginTop: 2
                            }}
                          >
                            host
                          </div>
                        )}
                      </div>
                    </div>
                    {summary && (
                      <div
                        style={{
                          fontSize: 12,
                          lineHeight: 1.5,
                          color: "var(--text-dim)",
                          display: "-webkit-box",
                          WebkitLineClamp: 4,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden"
                        }}
                      >
                        {summary}
                      </div>
                    )}
                    {(m as any).handle && (
                      <Link
                        href={`/u/${(m as any).handle}`}
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: "#1f8bff",
                          textDecoration: "none",
                          marginTop: "auto"
                        }}
                      >
                        view full portfolio →
                      </Link>
                    )}
                  </div>
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
