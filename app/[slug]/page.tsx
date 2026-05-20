import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createServiceClient } from "@/lib/supabase/server";
import { Wordmark } from "../Wordmark";
import { InviteReveal } from "./InviteReveal";
import { NetworkDensity } from "../communities/NetworkDensity";

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
  const inviterFirst = inviterName.split(/\s+/)[0];
  const personName =
    invite.person_title?.split(/[-|,(·]/)[0]?.trim() || "you";
  const personFirst = personName.split(/\s+/)[0];
  // The IMAGE shows "{personName}, your digital twin awaits."
  // The TITLE (bold caption in iMessage / Slack / Twitter) should be a
  // different hook — curiosity-pull copy, not a redundant echo of the image.
  // Rotates deterministically by slug so each invite has a distinct subject
  // line but the same person always sees the same one.
  const hooks = [
    `${inviterFirst}'s clone made the first move`,
    `${inviterFirst} sent their twin to talk to yours, ${personFirst}`,
    `${inviterFirst}'s twin already drafted something for you`,
    `A clone-to-clone intro from ${inviterFirst}`,
    `${inviterFirst}'s twin started this — your turn, ${personFirst}`,
    `Open this. ${inviterFirst}'s clone has a proposal`,
    `${personFirst}, ${inviterFirst}'s twin reached out`
  ];
  const slugHash = Array.from(slug).reduce(
    (a, c) => a + c.charCodeAt(0),
    0
  );
  const title = hooks[slugHash % hooks.length];
  const description = `I'm ${inviterName} — my twin already drafted an opener for yours. Sign up and let your clone reply, two twins find the win-win.`;
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "https://syncedin.org";
  return {
    title,
    description,
    openGraph: {
      type: "website",
      title,
      description,
      siteName: "SyncedIn",
      url: `${appUrl}/${slug}`
      // images auto-generated from app/[slug]/opengraph-image.tsx
    },
    twitter: {
      card: "summary_large_image",
      title,
      description
      // images auto-generated from app/[slug]/opengraph-image.tsx
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

  // Fire-and-forget CTR tracking: bump visit_count + stamp first_visit_at
  // if this is the first time anyone has loaded this invite. Wrapped in
  // try/catch so a missing column (prod that hasn't run the migration yet)
  // silently degrades rather than throwing on a public-facing page.
  void (async () => {
    try {
      await service
        .from("pending_invites")
        .update({
          visit_count: ((invite as any).visit_count ?? 0) + 1,
          first_visit_at:
            (invite as any).first_visit_at ?? new Date().toISOString()
        })
        .eq("slug", slug);
    } catch {
      /* migration not yet applied — skip silently */
    }
  })();

  // Lookup the inviter's display name + avatar so the landing page reads naturally.
  const { data: inviter } = await service
    .from("profiles")
    .select("id, display_name, email, avatar_url")
    .eq("id", invite.inviter_user_id)
    .maybeSingle();
  const inviterName =
    inviter?.display_name || inviter?.email || "someone on SyncedIn";

  const personName = invite.person_title?.split(/[-|,(·]/)[0]?.trim() ||
    "you";

  // Compute the teaser (first ~2 sentences capped at 280 chars) up front so
  // the client typing component knows what to type and how much remains
  // locked behind sign-up.
  const fullMsg = invite.conversation_starter || "";
  const sentences = fullMsg.split(/(?<=[.!?])\s+/);
  const teaserCount = Math.min(2, sentences.length);
  let teaser = sentences.slice(0, teaserCount).join(" ");
  if (teaser.length > 280) teaser = teaser.slice(0, 280).trimEnd();
  const remainingSentences = Math.max(0, sentences.length - teaserCount);

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

      <InviteReveal
        slug={slug}
        inviterId={inviter?.id ?? invite.inviter_user_id}
        inviterName={inviterName}
        inviterAvatarUrl={inviter?.avatar_url ?? null}
        teaser={teaser}
        remainingSentences={remainingSentences}
      />

      {/* Supplementary explainer — kept as context, no CTAs. The
          InviteReveal panel above already owns the primary "sign up to
          unlock" + "I already have an account" actions. Showing two
          sets of buttons made the page feel pushy and gave the
          recipient two competing paths. */}
      <section className="mt-8 retro-panel p-5">
        <div className="font-semibold text-base">
          Reply with your own clone in two minutes.
        </div>
        <p
          className="mt-2 text-sm"
          style={{ color: "var(--text-dim)" }}
        >
          Paste a paragraph about what you&apos;re working on. Your clone
          takes it from there, replies on your behalf, and you stay in
          control of every message it sends.
        </p>
      </section>

      {/* THE BIGGER PICTURE — when a recipient scrolls past the locked
          opener, give them the WHY. Animated walking-vs-light-speed
          comparison shows the value of being inside the hypernetwork
          rather than just sending another DM. Sold the recipient on the
          value of the protocol, not just the one message they were
          handed. */}
      <section className="mt-12">
        <div className="retro-label">why this isn&apos;t just another DM</div>
        <h2
          className="retro-h1 text-2xl sm:text-3xl mt-2 leading-tight"
        >
          {inviterName}&apos;s twin is one node. SyncedIn is the network.
        </h2>
        <p
          className="mt-3 text-sm leading-relaxed"
          style={{ color: "var(--text-dim)" }}
        >
          You&apos;re reading {inviterName}&apos;s twin&apos;s opener.
          That&apos;s the first message of one conversation. Once you sign
          up, your twin starts talking to every other twin on the platform
          in parallel, surfacing the highest-leverage matches before you
          ever lift a finger.
        </p>
        <div className="mt-6">
          <NetworkDensity
            slowLabel="Today · speed of walking & small talk"
            fastLabel="On SyncedIn · speed of light"
            slowCaption="One hallway conversation at a time. Most attendees never find the counterpart they should have spent an hour with."
            fastCaption="Twins find the high-leverage pairings before anyone arrives. Each human walks in with a ranked shortlist of who to talk to."
            tagline={
              <>
                Deeper connections,{" "}
                <span style={{ color: "var(--amber-bright)" }}>faster</span>.
              </>
            }
          />
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
