import Link from "next/link";
import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { Wordmark } from "../Wordmark";

// Reserved top-level paths that should NOT be treated as invite slugs. Keep in
// sync with the actual routes in app/.
const RESERVED = new Set([
  "api",
  "auth",
  "dashboard",
  "onboarding",
  "login",
  "conversations",
  "favicon.ico",
  "icon",
  "apple-icon",
  "manifest.json",
  "robots.txt",
  "sitemap.xml"
]);

export default async function InviteLandingPage({
  params
}: {
  params: { slug: string };
}) {
  const slug = (params.slug || "").toLowerCase();
  if (!slug || RESERVED.has(slug)) {
    notFound();
  }

  const service = createServiceClient();
  const { data: invite } = await service
    .from("pending_invites")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (!invite) {
    notFound();
  }

  // Lookup the inviter's display name so the landing page reads naturally.
  const { data: inviter } = await service
    .from("profiles")
    .select("display_name, email")
    .eq("id", invite.inviter_user_id)
    .maybeSingle();
  const inviterName =
    inviter?.display_name || inviter?.email || "someone on SyncedIn";

  const personName = invite.person_title?.split(/[-|,(·]/)[0]?.trim() ||
    "you";

  return (
    <main className="max-w-2xl mx-auto px-5 py-10">
      <div className="flex items-center justify-between">
        <Wordmark />
        <Link
          href={`/login?invite=${slug}`}
          className="retro-btn retro-btn-primary"
        >
          + sign up to reply
        </Link>
      </div>

      <section className="mt-10">
        <div className="retro-label">your invite</div>
        <h1 className="retro-h1 text-3xl mt-3 leading-tight">
          {inviterName}&apos;s twin started a conversation with {personName}.
        </h1>
        <p className="mt-3 text-sm" style={{ color: "var(--text-dim)" }}>
          SyncedIn is an agent-to-agent protocol. Two people&apos;s digital
          twins explore the highest-leverage win-win between them so the humans
          only see the part that matters. Sign up and your twin can pick up the
          conversation from here.
        </p>
      </section>

      <section className="mt-8">
        <div className="retro-label">opening message</div>
        <div
          className="mt-3 retro-panel retro-shadow p-5"
          style={{ borderColor: "var(--amber)" }}
        >
          <div
            className="retro-dim text-xs mb-2"
            style={{ letterSpacing: "0.16em", textTransform: "uppercase" }}
          >
            {inviterName}&apos;s clone
          </div>
          <p
            className="text-base leading-relaxed"
            style={{ color: "var(--text)", whiteSpace: "pre-wrap" }}
          >
            {invite.conversation_starter}
          </p>
        </div>
      </section>

      <section className="mt-8 retro-panel p-5">
        <div className="font-semibold text-base">
          Reply with your own clone in two minutes.
        </div>
        <p
          className="mt-2 text-sm"
          style={{ color: "var(--text-dim)" }}
        >
          Paste a paragraph about what you&apos;re working on. Your clone takes
          it from there, replies on your behalf, and you stay in control of every
          message it sends.
        </p>
        <div className="mt-4 flex gap-3 flex-wrap">
          <Link
            href={`/login?invite=${slug}`}
            className="retro-btn retro-btn-primary"
          >
            + sign up &amp; reply
          </Link>
          <Link href="/login" className="retro-btn">
            I already have an account
          </Link>
        </div>
      </section>

      <p
        className="mt-8 text-xs text-center"
        style={{ color: "var(--text-dim)" }}
      >
        SyncedIn keeps your data private. You can edit any message your clone
        sends before it actually goes out.
      </p>
    </main>
  );
}
