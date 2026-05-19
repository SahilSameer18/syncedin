import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "../AppShell";
import { BulkReachToolkit } from "../BulkReachToolkit";

export const metadata = {
  title: "Invite · SyncedIn",
  description:
    "The most context-aware invite on the internet. Drop a LinkedIn / X / Instagram / Facebook URL, an email, or a phone number — SyncedIn scrapes their public footprint, your twin writes a personal opener, and you send a one-of-one landing page they actually want to open."
};

/**
 * /invite — the deep-context invite hub.
 *
 * This page exists so the "invite a human" surface has its own dedicated
 * home in the sidebar. The dashboard has a slim version; this is the full
 * manifesto + the BulkReachToolkit at full strength.
 */
export default async function InvitePage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/invite");

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "https://syncedin.org";

  return (
    <AppShell>
      {/* MANIFESTO */}
      <section className="mt-4">
        <div className="retro-label">invite humans</div>
        <h1 className="retro-h1 text-4xl sm:text-5xl mt-3 leading-tight">
          The most context-aware invite on the internet.
        </h1>
        <p
          className="mt-5 text-base sm:text-lg leading-relaxed"
          style={{ color: "var(--text-dim)", maxWidth: 760 }}
        >
          Every other invite link on the internet is dead text — "join my
          team," "check out this app," same URL for everyone. The recipient
          opens it, sees a generic landing page, and bounces. SyncedIn does
          the opposite. Each invite becomes a one-of-one page that already
          knows who they are and why your twin would want to talk to them.
        </p>
      </section>

      {/* THE THREE-STEP CONTEXT GRAB */}
      <section className="mt-10">
        <div className="retro-label">how the context grab works</div>
        <h2 className="retro-h1 text-2xl mt-2">
          One profile URL becomes a personalized landing page.
        </h2>
        <p
          className="mt-3 text-sm leading-relaxed"
          style={{ color: "var(--text-dim)", maxWidth: 720 }}
        >
          The recipient never sees a sign-up wall, a CTA banner, or a
          generic "what is SyncedIn." They see a page about them, written by
          your twin, ending with one question.
        </p>

        <div className="mt-6 grid sm:grid-cols-3 gap-5">
          <Pillar
            k="01"
            t="You drop one signal"
            d="Paste their LinkedIn, X, Instagram, or Facebook URL. (Or email + name. Or phone + name.) That's the entire input."
          />
          <Pillar
            k="02"
            t="We scrape their public footprint"
            d="Bio, recent posts, follower count, captions, headlines. Whatever they've already put on the public internet becomes context for the opener — no guessing."
          />
          <Pillar
            k="03"
            t="Your twin writes a real opener"
            d="2-3 sentences in your voice that reference something specific from their profile. Ends with a question that makes them want to reply."
          />
        </div>
      </section>

      {/* WHY THIS IS DIFFERENT FROM EVERY OTHER INVITE */}
      <section className="mt-12">
        <div className="retro-label">why the click-through is higher</div>
        <h2 className="retro-h1 text-2xl mt-2">
          A landing page that mentions them by name. Always.
        </h2>
        <div className="mt-5 grid sm:grid-cols-2 gap-5">
          <DiffCard
            tag="every other invite"
            head="One link, generic page"
            body="Same URL for everyone. Same headline. Same CTA. Recipient feels like spam, closes it in 2 seconds."
            mood="dim"
          />
          <DiffCard
            tag="SyncedIn invite"
            head="One link, page about THEM"
            body="Title contains their name. Body opens with their specific work. Twin's opener references their actual posts. They've never seen this kind of personalization from an invite link."
            mood="amber"
          />
        </div>
      </section>

      {/* THE TOOLKIT — full BulkReach widget */}
      <section className="mt-14">
        <div className="retro-label">send invites now</div>
        <h2 className="retro-h1 text-2xl mt-2">
          Add who you want to invite.
        </h2>
        <p
          className="mt-3 text-sm leading-relaxed"
          style={{ color: "var(--text-dim)", maxWidth: 680 }}
        >
          Each entry becomes a custom landing page at
          <code style={{ color: "var(--amber-bright)", margin: "0 4px" }}>
            syncedin.org/their-name
          </code>
          with a twin-voice opener. Then send via iMessage, Email, WhatsApp,
          or copy the link anywhere.
        </p>

        <div className="mt-6">
          <BulkReachToolkit appUrl={appUrl} variant="card" />
        </div>
      </section>

      {/* CLOSING PROMISE */}
      <section className="mt-14 mb-8">
        <div
          className="retro-panel"
          style={{
            padding: 24,
            borderColor: "var(--amber)",
            background:
              "radial-gradient(800px 500px at 50% 0%, rgba(255,184,77,0.06), transparent 60%), var(--panel-solid)"
          }}
        >
          <div
            className="retro-label"
            style={{ color: "var(--amber-bright)" }}
          >
            the math
          </div>
          <h3 className="retro-h1 text-xl mt-2">
            Every personalized invite costs you 5 seconds. Every signup
            compounds the{" "}
            <Link
              href="/hypernetwork"
              style={{
                color: "var(--amber-bright)",
                textDecoration: "underline",
                textDecorationThickness: 2,
                textUnderlineOffset: 3
              }}
            >
              hypernetwork
            </Link>
            .
          </h3>
          <p
            className="mt-3 text-sm leading-relaxed"
            style={{ color: "var(--text-dim)", maxWidth: 720 }}
          >
            Twin onboarding is the bottleneck for everyone. The faster the
            people you want to talk to are inside SyncedIn, the faster your
            twin starts surfacing real win-wins. The fastest path: paste
            their profile URL above. Hit generate. Send the link.
          </p>
        </div>
      </section>
    </AppShell>
  );
}

function Pillar({ k, t, d }: { k: string; t: string; d: string }) {
  return (
    <div className="retro-panel" style={{ padding: "20px 22px" }}>
      <div className="retro-amber text-xs font-bold">{k}</div>
      <div className="mt-2 font-semibold text-sm">{t}</div>
      <div
        className="mt-2 retro-dim text-xs"
        style={{ lineHeight: 1.6 }}
      >
        {d}
      </div>
    </div>
  );
}

function DiffCard({
  tag,
  head,
  body,
  mood
}: {
  tag: string;
  head: string;
  body: string;
  mood: "dim" | "amber";
}) {
  const isAmber = mood === "amber";
  return (
    <div
      className="retro-panel"
      style={{
        padding: 20,
        borderColor: isAmber ? "var(--amber)" : "var(--border)",
        opacity: isAmber ? 1 : 0.85
      }}
    >
      <div
        className="retro-label"
        style={{ color: isAmber ? "var(--amber-bright)" : "var(--text-dim)" }}
      >
        {tag}
      </div>
      <div
        className="font-semibold text-sm mt-2"
        style={{ color: "var(--text)" }}
      >
        {head}
      </div>
      <div
        className="mt-2 retro-dim text-xs"
        style={{ lineHeight: 1.6 }}
      >
        {body}
      </div>
    </div>
  );
}
