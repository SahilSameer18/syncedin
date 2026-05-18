import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { Wordmark } from "../../Wordmark";
import { Avatar } from "../../Avatar";
import { startConversationWithUser } from "../../dashboard/actions";
import { BulkReachToolkit } from "../../BulkReachToolkit";
import { ShareUrlBox } from "./ShareUrlBox";

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

  // Members directory (only loaded if the visitor is a member).
  let members:
    | {
        id: string;
        display_name: string | null;
        email: string | null;
        avatar_url: string | null;
        goals: string | null;
      }[]
    | null = null;
  if (isMember) {
    const { data: memberRows } = await service
      .from("conference_members")
      .select("user_id")
      .eq("conference_slug", slug);
    const ids = (memberRows ?? []).map((r) => r.user_id);
    if (ids.length > 0) {
      const [{ data: profs }, { data: twins }] = await Promise.all([
        service
          .from("profiles")
          .select("id, display_name, email, avatar_url")
          .in("id", ids),
        service
          .from("twin_profiles")
          .select("user_id, goals")
          .in("user_id", ids)
      ]);
      const goalById = new Map(
        (twins ?? []).map((t) => [t.user_id, t.goals as string | null])
      );
      members = (profs ?? []).map((p) => ({
        id: p.id,
        display_name: p.display_name,
        email: p.email,
        avatar_url: (p as any).avatar_url ?? null,
        goals: goalById.get(p.id) ?? null
      }));
    }
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
  const joinUrl = `${appUrl}/conferences/${slug}`;
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
    <main className="max-w-5xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between">
        <Wordmark />
        <div className="flex items-center gap-4 text-sm">
          <Link href="/dashboard" className="retro-dim hover:text-white">
            dashboard
          </Link>
          {isOwner && (
            <Link
              href={`/conferences/${slug}/edit`}
              className="retro-dim hover:text-white"
            >
              edit
            </Link>
          )}
        </div>
      </div>

      {searchParams.created === "1" && (
        <p className="mt-4 retro-green text-sm">
          ✓ Conference created. Share the link below — anyone who joins
          through it becomes a member of {conf.name}.
        </p>
      )}

      {/* HERO */}
      <section className="mt-8 grid lg:grid-cols-[1fr_240px] gap-8 items-start">
        <div className="min-w-0">
          <div className="retro-label">conference</div>
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

          {/* STATS */}
          <div className="mt-5 grid grid-cols-3 gap-2 max-w-md">
            <Stat
              n={attendeeCount ?? 0}
              label="attendees"
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

      {/* CTAs based on viewer state */}
      {!user && (
        <section className="mt-8 retro-panel p-6">
          <div className="retro-label">join {conf.name}</div>
          <p
            className="mt-2 text-base"
            style={{ color: "var(--text-dim)" }}
          >
            Sign up below. You&apos;ll only see and be seen by other attendees
            of this conference.
          </p>
          <Link
            href={`/login?conference=${slug}`}
            className="retro-btn retro-btn-primary mt-4 inline-block"
          >
            + Sign up &amp; join
          </Link>
        </section>
      )}

      {user && !isMember && !isOwner && (
        <section className="mt-8 retro-panel p-6">
          <p className="text-base">
            You&apos;re signed in but not a member of this conference yet.
          </p>
          <Link
            href={`/conferences/${slug}/join`}
            className="retro-btn retro-btn-primary mt-4 inline-block"
          >
            + Join {conf.name}
          </Link>
        </section>
      )}

      {/* OWNER toolkit */}
      {isOwner && (
        <section className="mt-10">
          <div className="retro-label" style={{ color: "var(--amber-bright)" }}>
            host toolkit
          </div>
          <p className="retro-dim text-xs mt-1">
            Invite attendees in bulk. Every link you generate carries the{" "}
            {conf.name} conference tag so signups land them inside this
            community automatically.
          </p>
          <div className="mt-4">
            <BulkReachToolkit appUrl={joinUrl} variant="card" />
          </div>
        </section>
      )}

      {/* ATTENDEE DIRECTORY (members only) */}
      {isMember && members && (
        <section className="mt-12">
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
