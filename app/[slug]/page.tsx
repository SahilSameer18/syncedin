import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createServiceClient } from "@/lib/supabase/server";
import { Wordmark } from "../Wordmark";
import { InviteReveal } from "./InviteReveal";
import { NetworkDensity } from "../communities/NetworkDensity";
import { AnimatedHero } from "./AnimatedHero";
import { DemoConversation } from "./DemoConversation";
import { observationSnippet, buildInviteCopy } from "@/lib/invite-copy";

// Force per-request render — Next.js was caching the Supabase fetch result
// for missing-slug 404s, so even after a row was backfilled the page kept
// serving 404 from the function-level data cache. Marking the route
// fully-dynamic guarantees a fresh Supabase lookup every visit.
export const dynamic = "force-dynamic";
export const revalidate = 0;

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

  // Compute the teaser up front so the client typing component knows what
  // to type and how much remains locked behind sign-up. The landing-page
  // message is now LONGER (5-8 sentences of scrape-driven personalization,
  // not 3 sentences of generic platform-intro), so we let ~3 sentences /
  // 480 chars through before the lock — enough to prove this is real
  // personalization, not enough to remove the reason to sign up.
  const fullMsg = invite.conversation_starter || "";
  const sentences = fullMsg.split(/(?<=[.!?])\s+/);
  const teaserCount = Math.min(3, sentences.length);
  let teaser = sentences.slice(0, teaserCount).join(" ");
  if (teaser.length > 480) teaser = teaser.slice(0, 480).trimEnd();
  const remainingSentences = Math.max(0, sentences.length - teaserCount);

  // Compute the snippet + headline/body once so the animated hero and any
  // future surfaces share the exact same wording (and stay in sync with
  // the OG card, which also pulls from lib/invite-copy).
  const snippet = observationSnippet(invite.conversation_starter);
  const heroCopy = buildInviteCopy({
    inviterFullName: inviterName,
    recipientShortName: personName,
    snippet
  });
  const inviterFirst = (inviterName.split(/\s+/)[0] || "Jackson").trim();
  const recipientInitials =
    personName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "??";

  return (
    <main className="max-w-2xl mx-auto px-5 py-10">
      <div className="flex items-center justify-between">
        <Wordmark />
        <Link
          href={`/login?invite=${slug}`}
          className="retro-btn retro-btn-primary"
        >
          + sign up &amp; auto-reply
        </Link>
      </div>

      {/* Animated landing hero — infinity drift + gradient shimmer +
          floating particles + typing pill. The static OG image (rendered
          by Next ImageResponse) handles the link-preview moment because
          iMessage/Twitter/LinkedIn all rasterize OG images to a single
          frame. The animation lives HERE, on the page the recipient
          lands on after tapping the preview — that's where motion pays
          off. */}
      <section className="mt-6">
        <AnimatedHero
          headline={heroCopy.headline}
          body={heroCopy.body}
          recipientInitials={recipientInitials}
          recipientAvatarUrl={(invite as any).recipient_avatar_url ?? null}
          inviterFirstName={inviterFirst}
          inviterAvatarUrl={inviter?.avatar_url ?? null}
        />
      </section>

      {/* PRE-AUTH DEMO CONVERSATION — the big shift. Instead of locking
          the recipient out of the message until they sign up, we now
          render a full simulated twin-to-twin conversation built from
          the LinkedIn scrape we already have on the invite row. The
          recipient can paste more context on the right, edit any line,
          and regenerate — sign-in is moved to "open the final deal
          proposal" only. The old InviteReveal still ships below as a
          secondary collapsed teaser of the inviter's actual drafted
          opener, but the demo above is the primary surface. */}
      <section className="mt-6">
        <DemoConversation
          slug={slug}
          initialMessages={[]}
          inviterName={inviterName}
          recipientName={personName}
          inviterAvatarUrl={inviter?.avatar_url ?? null}
          recipientAvatarUrl={(invite as any).recipient_avatar_url ?? null}
        />
      </section>

      {/* Existing inviter-drafted opener stays as secondary context —
          collapsed by default, the demo above is the primary surface
          now. Keeps recipients who scrolled the original CTA flow
          unbroken while the new demo carries the main attention. */}
      <InviteReveal
        slug={slug}
        inviterId={inviter?.id ?? invite.inviter_user_id}
        inviterName={inviterName}
        inviterAvatarUrl={inviter?.avatar_url ?? null}
        teaser={teaser}
        remainingSentences={remainingSentences}
      />

      {/* MERGED EXPLAINER — folds three previously-separate blocks
          ("Reply with your own clone" panel + "AND THAT'S NOT ALL"
          connector + "why this isn't just another DM" intro) into one
          tight beat. They were all saying overlapping things — that
          replying with your clone joins a wider network. Now there's
          one pill + one paragraph + the network animation immediately
          below. */}
      <section className="mt-10" style={{ textAlign: "center" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 18px",
            borderRadius: 999,
            background:
              "linear-gradient(90deg, #1f8bff22, #6b2dc922, #d83bff22)",
            border: "1px solid var(--border)",
            fontWeight: 800,
            fontSize: 15,
            letterSpacing: "0.02em",
            color: "var(--amber-bright)",
            textTransform: "uppercase"
          }}
        >
          <span aria-hidden="true">⚡</span>
          <span>and that&apos;s not all!</span>
          <span aria-hidden="true">⚡</span>
        </div>
        <p
          className="mt-4 text-sm mx-auto leading-relaxed"
          style={{
            color: "var(--text-dim)",
            maxWidth: 560
          }}
        >
          Paste a paragraph about what you&apos;re working on — your clone
          takes it from there. You&apos;re not just replying to{" "}
          {inviterName.split(/\s+/)[0]} either. Your twin joins a growing
          network, quietly surfacing the highest-leverage win-wins and
          keeping you in touch with people you&apos;d otherwise lose
          track of. One reply, a whole network unlocked.
        </p>
      </section>

      {/* THE BIGGER PICTURE — animated walking-vs-light-speed comparison
          shows the value of being inside the hypernetwork rather than
          just sending another DM. */}
      <section className="mt-10">
        <h2
          className="retro-h1 text-2xl sm:text-3xl leading-tight text-center"
        >
          One node. <span style={{ color: "var(--amber-bright)" }}>The whole network.</span>
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

      {/* Second-chance CTA — after the recipient has read the entire
          page (opener, "AND THAT'S NOT ALL", network animation), give
          them one more clear path forward. The InviteReveal at the top
          owns the "sign up to unlock the message" framing; this bottom
          CTA frames the same action as "create my personal networking
          agent" — same destination, different angle for the type of
          reader who scrolled all the way down. */}
      <section className="mt-10 text-center">
        <Link
          href={`/login?invite=${slug}`}
          className="retro-btn retro-btn-primary"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            padding: "14px 28px",
            fontSize: 16,
            fontWeight: 800,
            borderRadius: 14,
            boxShadow: "0 12px 32px -12px rgba(58, 77, 255, 0.55)"
          }}
        >
          <span aria-hidden="true">＋</span>
          Create my personal networking agent
        </Link>
        <p
          className="mt-3 text-xs"
          style={{ color: "var(--text-dim)" }}
        >
          Two minutes to spin up. Free forever for early users.
        </p>
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
