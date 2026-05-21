import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createServiceClient } from "@/lib/supabase/server";
import { Wordmark } from "../Wordmark";
import { NetworkDensity } from "../communities/NetworkDensity";
import { DemoConversation } from "./DemoConversation";

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

  const inviterFirst = (inviterName.split(/\s+/)[0] || "Jackson").trim();
  const personFirst = (personName.split(/\s+/)[0] || personName).trim();

  // Explicit `string` annotation — Next 14 strict TS doesn't let us rely
  // on `.filter(Boolean)` narrowing here, so the param would otherwise
  // be implicit `any` and fail the prod build.
  const recipientInitials =
    personName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p: string) => p[0]?.toUpperCase() ?? "")
      .join("") || "??";
  const inviterInitials =
    inviterName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p: string) => p[0]?.toUpperCase() ?? "")
      .join("") || "??";

  // LinkedIn context blob that the scrape pipeline stashed on the invite
  // row when the invite was created. The recipient sees this as editable
  // copy in the right panel — they can correct what's wrong, and the
  // simulation regenerates against the corrected context.
  const linkedinContext =
    (invite as any).person_highlights?.toString().trim() ||
    invite.person_title?.toString().trim() ||
    "";
  const recipientAvatarUrl =
    (invite as any).recipient_avatar_url ?? null;

  return (
    <main className="invite-shell">
      {/* Ambient gradient backdrop — radial bloom in the top-third that
          fades to nothing. Lives in the page, not the body, so it doesn't
          fight the rest of the app's chrome. Subtle enough that you only
          notice it if you're looking for it; that's the point. */}
      <div aria-hidden="true" className="invite-bg" />

      <style>{`
        .invite-shell {
          position: relative;
          min-height: 100vh;
          padding: 18px clamp(16px, 4vw, 40px) 64px;
          max-width: 1400px;
          margin: 0 auto;
        }
        .invite-bg {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 0;
          background:
            radial-gradient(900px 500px at 12% 8%, rgba(255, 176, 32, 0.10), transparent 60%),
            radial-gradient(900px 600px at 88% 4%, rgba(31, 139, 255, 0.10), transparent 60%),
            radial-gradient(700px 400px at 50% 100%, rgba(216, 59, 255, 0.06), transparent 60%);
        }
        .invite-content {
          position: relative;
          z-index: 1;
        }
        .invite-nav {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 6px 0 4px;
        }
        .invite-hero {
          margin-top: 28px;
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          gap: 18px;
          align-items: end;
        }
        @media (min-width: 900px) {
          .invite-hero {
            grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr);
            gap: 32px;
          }
        }
        .invite-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 12px;
          border-radius: 999px;
          background: rgba(255, 176, 32, 0.08);
          border: 1px solid rgba(255, 176, 32, 0.30);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--amber-bright);
        }
        .invite-eyebrow .dot {
          width: 6px;
          height: 6px;
          border-radius: 999px;
          background: #22c55e;
          box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.18);
        }
        .invite-headline {
          margin-top: 14px;
          font-size: clamp(28px, 4.4vw, 48px);
          line-height: 1.05;
          letter-spacing: -0.02em;
          font-weight: 800;
        }
        .invite-headline em {
          font-style: normal;
          background: linear-gradient(90deg, #ffb020, #ffd66b 70%, #fff0a8);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }
        .invite-sub {
          margin-top: 14px;
          font-size: clamp(15px, 1.4vw, 17px);
          line-height: 1.55;
          color: var(--text-dim);
          max-width: 640px;
        }
        .invite-people {
          margin-top: 22px;
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .invite-avatars {
          display: flex;
          align-items: center;
        }
        .invite-avatars .av {
          width: 44px;
          height: 44px;
          border-radius: 999px;
          background: linear-gradient(135deg, #1f8bff, #6b2dc9);
          color: #fff;
          font-weight: 700;
          font-size: 14px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          box-shadow: 0 0 0 3px var(--bg);
        }
        .invite-avatars .av:not(:first-child) { margin-left: -14px; }
        .invite-avatars .av img { width: 100%; height: 100%; object-fit: cover; }
        .invite-people-meta { font-size: 13px; color: var(--text-dim); line-height: 1.4; }
        .invite-people-meta b { color: var(--text); font-weight: 700; }
        .invite-stats {
          margin-top: 28px;
          display: flex;
          gap: 18px;
          flex-wrap: wrap;
        }
        .invite-stat {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .invite-stat .v {
          font-size: 22px;
          font-weight: 800;
          letter-spacing: -0.01em;
          color: var(--text);
        }
        .invite-stat .l {
          font-size: 11px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--text-dim);
        }
        /* Right-side hero card — anchored CTA + premise summary */
        .invite-hero-card {
          background: linear-gradient(180deg, rgba(20, 20, 24, 0.6), rgba(20, 20, 24, 0.35));
          border: 1px solid var(--border);
          border-radius: 22px;
          padding: 22px;
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          box-shadow: 0 24px 80px -36px rgba(0, 0, 0, 0.6);
        }
        .invite-cta {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 14px 18px;
          width: 100%;
          font-size: 15px;
          font-weight: 800;
          border-radius: 14px;
          box-shadow:
            0 12px 36px -14px rgba(255, 176, 32, 0.55),
            0 0 0 1px rgba(255, 176, 32, 0.35) inset;
        }
        .invite-cta-secondary {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px 16px;
          width: 100%;
          font-size: 13px;
          font-weight: 700;
          border-radius: 12px;
          margin-top: 10px;
          color: var(--text-dim);
        }
        .invite-section-label {
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: var(--amber-bright);
        }
        .invite-demo-wrap {
          margin-top: 36px;
        }
        .invite-divider {
          margin: 56px auto 36px;
          height: 1px;
          max-width: 220px;
          background: linear-gradient(90deg, transparent, var(--border), transparent);
        }
        .invite-footer-cta {
          text-align: center;
          margin-top: 56px;
          padding: 36px 24px;
          border-radius: 24px;
          background:
            radial-gradient(600px 240px at 50% 0%, rgba(255, 176, 32, 0.10), transparent 70%),
            linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0));
          border: 1px solid var(--border);
        }
      `}</style>

      <div className="invite-content">
        <nav className="invite-nav">
          <Wordmark />
          <Link
            href={`/login?invite=${slug}`}
            className="retro-btn retro-btn-primary"
            style={{ fontSize: 13, padding: "8px 14px" }}
          >
            + sign up
          </Link>
        </nav>

        {/* HERO — left column carries the human narrative (who, why,
            what they're doing here). Right column anchors the action.
            On mobile they stack; the action card stays second so the
            story reads top-down. */}
        <header className="invite-hero">
          <div>
            <span className="invite-eyebrow">
              <span className="dot" />
              {inviterFirst}&apos;s twin started a conversation
            </span>
            <h1 className="invite-headline">
              {personFirst}, two clones are{" "}
              <em>already mid-negotiation</em> for you.
            </h1>
            <p className="invite-sub">
              {inviterFirst} sent their digital twin to talk to yours.
              We sketched the conversation below using {personFirst}&apos;s
              public footprint — read it like a live transcript, edit
              anything that doesn&apos;t sound right, and let your own
              twin take over when you&apos;re ready.
            </p>

            <div className="invite-people">
              <div className="invite-avatars">
                <div className="av" aria-hidden="true">
                  {inviter?.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={inviter.avatar_url} alt="" />
                  ) : (
                    inviterInitials
                  )}
                </div>
                <div className="av" aria-hidden="true">
                  {recipientAvatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={recipientAvatarUrl} alt="" />
                  ) : (
                    recipientInitials
                  )}
                </div>
              </div>
              <div className="invite-people-meta">
                <b>{inviterFirst}</b> &nbsp;↔&nbsp; <b>{personFirst}</b>
                <br />
                Two twins, one shared interest, zero scheduling friction.
              </div>
            </div>

            <div className="invite-stats">
              <div className="invite-stat">
                <span className="v">90s</span>
                <span className="l">to spin up a twin</span>
              </div>
              <div className="invite-stat">
                <span className="v">24/7</span>
                <span className="l">working for you</span>
              </div>
              <div className="invite-stat">
                <span className="v">0</span>
                <span className="l">cold-DM energy spent</span>
              </div>
            </div>
          </div>

          <aside className="invite-hero-card">
            <span className="invite-section-label">your move</span>
            <p
              style={{
                marginTop: 10,
                fontSize: 14,
                lineHeight: 1.5,
                color: "var(--text-dim)"
              }}
            >
              Spin up your own twin in under two minutes. It picks up
              where the simulation below leaves off — and starts working
              every other relationship you care about in parallel.
            </p>
            <div style={{ marginTop: 18 }}>
              <Link
                href={`/login?invite=${slug}`}
                className="retro-btn retro-btn-primary invite-cta"
              >
                <span aria-hidden="true">＋</span>
                Create my twin
              </Link>
              <Link
                href={`/login?invite=${slug}`}
                className="retro-btn invite-cta-secondary"
              >
                Sign in to reply →
              </Link>
            </div>
            <p
              style={{
                marginTop: 14,
                fontSize: 11,
                color: "var(--text-dim)",
                textAlign: "center",
                letterSpacing: "0.02em"
              }}
            >
              Free for early users. Edit any reply before it sends.
            </p>
          </aside>
        </header>

        {/* PRE-AUTH DEMO CONVERSATION — full-width primary surface.
            Seeds with the inviter's actual drafted opener as message 1
            so the recipient sees the real first line, then can guide
            the simulation forward by editing context, IG/X handles,
            or pasting raw AI prompts. */}
        <section className="invite-demo-wrap">
          <DemoConversation
            slug={slug}
            initialMessages={[]}
            inviterName={inviterName}
            recipientName={personName}
            inviterAvatarUrl={inviter?.avatar_url ?? null}
            recipientAvatarUrl={recipientAvatarUrl}
            seedFirstMessage={invite.conversation_starter || ""}
            linkedinContext={linkedinContext}
          />
        </section>

        <div className="invite-divider" />

        {/* THE BIGGER PICTURE — animated walking-vs-light-speed comparison
            shows the value of being inside the hypernetwork rather than
            just sending another DM. */}
        <section>
          <div style={{ textAlign: "center", maxWidth: 720, margin: "0 auto" }}>
            <span className="invite-section-label">why this matters</span>
            <h2
              className="retro-h1"
              style={{
                marginTop: 12,
                fontSize: "clamp(22px, 3vw, 32px)",
                lineHeight: 1.15
              }}
            >
              One reply.{" "}
              <span style={{ color: "var(--amber-bright)" }}>
                The whole network unlocked.
              </span>
            </h2>
            <p
              style={{
                marginTop: 14,
                fontSize: 15,
                lineHeight: 1.6,
                color: "var(--text-dim)"
              }}
            >
              The conversation above is one of dozens your twin can run in
              parallel the moment you sign up — quietly surfacing the
              highest-leverage win-wins and keeping you in touch with
              people you&apos;d otherwise lose track of.
            </p>
          </div>
          <div style={{ marginTop: 28 }}>
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

        <section className="invite-footer-cta">
          <span className="invite-section-label">ready when you are</span>
          <h3
            style={{
              marginTop: 10,
              fontSize: "clamp(20px, 2.5vw, 28px)",
              fontWeight: 800,
              letterSpacing: "-0.01em"
            }}
          >
            Spin up your personal networking agent
          </h3>
          <p
            style={{
              marginTop: 10,
              fontSize: 14,
              color: "var(--text-dim)",
              maxWidth: 520,
              margin: "10px auto 0",
              lineHeight: 1.5
            }}
          >
            Two minutes to set up. Free forever for early users. Edit
            every message your twin sends before it actually goes out.
          </p>
          <div style={{ marginTop: 22 }}>
            <Link
              href={`/login?invite=${slug}`}
              className="retro-btn retro-btn-primary"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                padding: "14px 28px",
                fontSize: 15,
                fontWeight: 800,
                borderRadius: 14,
                boxShadow:
                  "0 16px 48px -16px rgba(255, 176, 32, 0.55), 0 0 0 1px rgba(255, 176, 32, 0.35) inset"
              }}
            >
              <span aria-hidden="true">＋</span>
              Create my twin
            </Link>
          </div>
          <p
            style={{
              marginTop: 14,
              fontSize: 11,
              color: "var(--text-dim)"
            }}
          >
            SyncedIn keeps your data private. You stay in the loop on every send.
          </p>
        </section>
      </div>
    </main>
  );
}
