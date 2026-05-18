import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { Wordmark } from "../../Wordmark";
import { Avatar } from "../../Avatar";
import { startConversationWithUser } from "../../dashboard/actions";

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

  // Member check (server-side, bypasses RLS via service for the page query).
  let isMember = false;
  if (user) {
    const { data: m } = await service
      .from("conference_members")
      .select("user_id")
      .eq("conference_slug", slug)
      .eq("user_id", user.id)
      .maybeSingle();
    isMember = !!m;
  }

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
        service.from("twin_profiles").select("user_id, goals").in("user_id", ids)
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

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "https://syncedin.org";
  const joinUrl = `${appUrl}/conferences/${slug}`;

  return (
    <main className="max-w-4xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between">
        <Wordmark />
        <Link href="/dashboard" className="retro-dim text-xs">
          dashboard &gt;
        </Link>
      </div>

      {searchParams.created === "1" && (
        <p className="mt-4 retro-green text-sm">
          ✓ Conference created. Share the link below with your attendees.
        </p>
      )}

      <section className="mt-8">
        <div className="retro-label">conference</div>
        <h1 className="retro-h1 text-4xl mt-3 leading-tight">{conf.name}</h1>
        {(conf.starts_at || conf.city) && (
          <p
            className="mt-2 text-sm"
            style={{ color: "var(--text-dim)" }}
          >
            {[
              conf.starts_at && new Date(conf.starts_at).toLocaleDateString(),
              conf.ends_at && new Date(conf.ends_at).toLocaleDateString(),
              conf.city
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}
        {conf.description && (
          <p className="mt-3 text-base">{conf.description}</p>
        )}

        <div className="mt-4 retro-panel p-3 flex items-center gap-2">
          <span className="retro-label">share to attendees</span>
          <code
            className="flex-1 text-xs font-mono"
            style={{ color: "var(--amber-bright)", wordBreak: "break-all" }}
          >
            {joinUrl}
          </code>
        </div>
      </section>

      {!user && (
        <section className="mt-10 retro-panel p-6">
          <div className="retro-label">join {conf.name}</div>
          <p
            className="mt-2 text-base"
            style={{ color: "var(--text-dim)" }}
          >
            Sign up with the link below. You&apos;ll only see and be seen by
            other attendees of this conference.
          </p>
          <Link
            href={`/login?conference=${slug}`}
            className="retro-btn retro-btn-primary mt-4 inline-block"
          >
            + Sign up &amp; join
          </Link>
        </section>
      )}

      {user && !isMember && (
        <section className="mt-10 retro-panel p-6">
          <p className="text-base">You&apos;re signed in, but not a member of this conference yet.</p>
          <Link
            href={`/conferences/${slug}/join`}
            className="retro-btn retro-btn-primary mt-4 inline-block"
          >
            + Join {conf.name}
          </Link>
        </section>
      )}

      {isMember && members && (
        <section className="mt-10">
          <div className="retro-label">
            attendees · {members.length}
          </div>
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
        </section>
      )}
    </main>
  );
}
