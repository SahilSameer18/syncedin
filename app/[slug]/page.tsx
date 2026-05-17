import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
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
  "privacy",
  "terms",
  "favicon.ico",
  "icon",
  "apple-icon",
  "manifest.json",
  "robots.txt",
  "sitemap.xml"
]);

export async function generateMetadata({
  params
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const slug = (params.slug || "").toLowerCase();
  if (!slug || RESERVED.has(slug)) {
    return {};
  }
  const service = createServiceClient();
  const { data: invite } = await service
    .from("pending_invites")
    .select("inviter_user_id, person_title")
    .eq("slug", slug)
    .maybeSingle();
  if (!invite) {
    return {};
  }
  const { data: inviter } = await service
    .from("profiles")
    .select("display_name, email")
    .eq("id", invite.inviter_user_id)
    .maybeSingle();
  const inviterName =
    inviter?.display_name ||
    inviter?.email?.split("@")[0] ||
    "Their twin";
  const personName =
    invite.person_title?.split(/[-|,(·]/)[0]?.trim() || "you";
  const title = `${personName}, your digital twin awaits`;
  const description = `${inviterName} sent you a SyncedIn invite. Their clone has already started a conversation. Sign up and your clone replies, two twins find the win-win.`;
  return {
    title,
    description,
    openGraph: {
      type: "website",
      title,
      description,
      siteName: "SyncedIn"
    },
    twitter: {
      card: "summary_large_image",
      title,
      description
    }
  };
}

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

      {(() => {
        const full = invite.conversation_starter || "";
        // Reveal roughly the first two sentences so the visitor gets the
        // specific hook, then everything else is gated behind sign-up.
        const sentences = full.split(/(?<=[.!?])\s+/);
        const teaserSentences = Math.min(2, sentences.length);
        let teaser = sentences.slice(0, teaserSentences).join(" ");
        // Hard cap so a single long sentence doesn't dump the whole message.
        if (teaser.length > 280) teaser = teaser.slice(0, 280).trimEnd();
        const remainingSentences = sentences.length - teaserSentences;
        const remainingChars = Math.max(0, full.length - teaser.length);
        return (
          <section className="mt-8">
            <div className="retro-label">opening message</div>
            <div
              className="mt-3 retro-panel retro-shadow p-5 relative"
              style={{ borderColor: "var(--amber)" }}
            >
              <div
                className="retro-dim text-xs mb-2"
                style={{
                  letterSpacing: "0.16em",
                  textTransform: "uppercase"
                }}
              >
                {inviterName}&apos;s clone
              </div>
              <p
                className="text-base leading-relaxed"
                style={{ color: "var(--text)", whiteSpace: "pre-wrap" }}
              >
                {teaser}
                <span style={{ color: "var(--text-dim)" }}>
                  {teaser.endsWith(".") ||
                  teaser.endsWith("!") ||
                  teaser.endsWith("?")
                    ? " ..."
                    : "..."}
                </span>
              </p>

              {remainingChars > 0 && (
                <div
                  className="mt-5 pt-4"
                  style={{ borderTop: "1px dashed var(--border-bright)" }}
                >
                  <div
                    className="retro-label"
                    style={{ color: "var(--amber-bright)" }}
                  >
                    locked · sign up to read the rest
                  </div>
                  <p
                    className="mt-2 text-sm"
                    style={{ color: "var(--text-dim)" }}
                  >
                    There are {remainingSentences} more sentences in this
                    message. Sign up and your twin can read all of it AND
                    continue the conversation with {inviterName}&apos;s
                    clone, looking for the highest win-win between you.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      href={`/login?invite=${slug}`}
                      className="retro-btn retro-btn-primary"
                    >
                      + sign up to unlock
                    </Link>
                    <Link
                      href={`/login?invite=${slug}`}
                      className="retro-btn"
                    >
                      I already have an account
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </section>
        );
      })()}

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
