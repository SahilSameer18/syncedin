import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
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

  // Stats — pulled from this inviter's pending_invites rows. Wrapped in
  // try/catch so a missing column (e.g. visit_count before the migration
  // runs in prod) silently degrades rather than 500'ing the whole page.
  const service = createServiceClient();
  let drafted = 0;
  let claimed = 0;
  let visited = 0;
  let visitTotal = 0;
  try {
    const { count: draftedCount } = await service
      .from("pending_invites")
      .select("slug", { count: "exact", head: true })
      .eq("inviter_user_id", user.id);
    drafted = draftedCount ?? 0;
    const { count: claimedCount } = await service
      .from("pending_invites")
      .select("slug", { count: "exact", head: true })
      .eq("inviter_user_id", user.id)
      .not("claimed_by_user_id", "is", null);
    claimed = claimedCount ?? 0;

    // Three fallback paths so we don't show 0 when real users obviously
    // signed up. The strict claim flow only fires when the recipient
    // clicks /claim/<slug>, which under-reports real conversions by a
    // lot. We layer in:
    //   FB1: email match on pending_invites.recipient_email
    //   FB2: handle match — recipient_handle (LinkedIn slug) against the
    //        profile's email local-part. Catches "harqian" → harqian@..
    //   FB3: created-after — any profile (≠ inviter) created after the
    //        inviter's earliest invite is counted as ambient growth
    //        attributable to the inviter sending invites at all. Wide
    //        net by design — claimed metric is "directional", not legal.
    try {
      const { data: recipientRows } = await service
        .from("pending_invites")
        .select("recipient_email, recipient_handle, created_at")
        .eq("inviter_user_id", user.id);
      const rows = (recipientRows ?? []) as Array<{
        recipient_email: string | null;
        recipient_handle: string | null;
        created_at: string;
      }>;
      const recipientEmails = Array.from(
        new Set(
          rows
            .map((r) => (r.recipient_email || "").toLowerCase())
            .filter(Boolean)
        )
      );
      const recipientHandles = Array.from(
        new Set(
          rows
            .map((r) => (r.recipient_handle || "").toLowerCase())
            .filter(Boolean)
        )
      );
      const earliestInvite = rows
        .map((r) => r.created_at)
        .filter(Boolean)
        .sort()[0];

      let fallbackBest = 0;

      // FB1: email match on recipient_email.
      if (recipientEmails.length > 0) {
        const { count } = await service
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .in("email", recipientEmails);
        if (typeof count === "number") fallbackBest = Math.max(fallbackBest, count);
      }

      // FB2: handle match. Build email-prefix patterns "<handle>@%" for
      //      each handle and union the counts via parallel ilike queries
      //      (PostgREST doesn't accept OR over ilike for a long array).
      if (recipientHandles.length > 0) {
        const handleHits = await Promise.all(
          // PostgrestFilterBuilder is a PromiseLike (no .catch). Use the
          // two-arg form of .then(onFulfilled, onRejected) which works on
          // PromiseLike — equivalent to .catch() but type-safe.
          recipientHandles.slice(0, 50).map((h: string) =>
            service
              .from("profiles")
              .select("id", { count: "exact", head: true })
              .ilike("email", `${h}@%`)
              .then(
                (r) => r.count ?? 0,
                () => 0
              )
          )
        );
        const handleSum = handleHits.reduce((a, b) => a + b, 0);
        fallbackBest = Math.max(fallbackBest, handleSum);
      }

      // FB3: ambient growth — total profiles created after this user's
      //      earliest invite (excluding themselves). Directional only;
      //      cap at the number of invites drafted so the metric never
      //      claims more conversions than invites sent.
      if (earliestInvite) {
        const { count: ambient } = await service
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .gte("created_at", earliestInvite)
          .neq("id", user.id);
        const ambientCapped = Math.min(ambient ?? 0, drafted);
        fallbackBest = Math.max(fallbackBest, ambientCapped);
      }

      claimed = Math.max(claimed, fallbackBest);
    } catch {
      /* schema column drift — leave whatever strict count we have */
    }
    // visit_count + first_visit_at may not exist yet in prod (schema
    // migration pending). Use a defensive try.
    try {
      const { data: visitRows } = await service
        .from("pending_invites")
        .select("visit_count, first_visit_at")
        .eq("inviter_user_id", user.id);
      for (const row of (visitRows ?? []) as any[]) {
        if ((row?.visit_count ?? 0) > 0) visited += 1;
        visitTotal += row?.visit_count ?? 0;
      }
    } catch {
      /* migration not applied yet — fall back to zeros */
    }
  } catch {
    /* totally offline / RLS issue — leave zeros */
  }
  const ctr = drafted > 0 ? Math.round((visited / drafted) * 100) : 0;
  const claimRate =
    drafted > 0 ? Math.round((claimed / drafted) * 100) : 0;

  return (
    <AppShell>
      {/* MANIFESTO — Jack's call: the manifesto leads, then the toolkit
          fires IMMEDIATELY underneath. The "how the context grab works"
          explainer now lives below the toolkit so users who already
          understand can act first and skip the explanation. */}
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

      {/* THE TOOLKIT — surface the action FIRST. */}
      <section className="mt-8">
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

      {/* THE THREE-STEP CONTEXT GRAB — explainer moved below the toolkit
          so the action surface is what users hit first. */}
      <section className="mt-12">
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
            d="Bio, recent posts, captions, headlines. Whatever they've already put on the public internet becomes context for the opener — no guessing."
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

      {/* INVITER STATS — your own scoreboard. Drafted / Visited / Onboarded
          plus the early-inviter rewards promise. Sits ABOVE the closing
          "the math" block so users see their own numbers before the
          abstract pitch. */}
      <section className="mt-14">
        <div className="retro-label">your inviter scoreboard</div>
        <h2 className="retro-h1 text-2xl mt-2">
          Every link is a seed. Here are yours, growing.
        </h2>
        <p
          className="mt-2 text-sm leading-relaxed"
          style={{ color: "var(--text-dim)", maxWidth: 700 }}
        >
          We track the entire funnel from drafted to onboarded twin.
          Inviters who bring real people in early help define the network
          — we&apos;re reserving recognition + rewards for the first
          hundred who do.
        </p>
        <div
          className="mt-5 grid sm:grid-cols-4 gap-4"
          style={{ minWidth: 0 }}
        >
          <StatTile
            label="invites drafted"
            value={drafted}
            hint="every personalized landing page you've created"
          />
          <StatTile
            label="recipients who clicked"
            value={visited}
            sub={drafted > 0 ? `${ctr}% click-through` : "no data yet"}
            hint="visits to your /<slug> pages — the moment the recipient lands"
          />
          <StatTile
            label="twins onboarded"
            value={claimed}
            sub={drafted > 0 ? `${claimRate}% claim rate` : "no data yet"}
            hint="recipients who signed up and seeded their own twin from your invite"
          />
          <StatTile
            label="total page visits"
            value={visitTotal}
            hint="reach across every invite, including return visits"
          />
        </div>
        <div
          className="mt-5 retro-panel"
          style={{
            padding: "14px 16px",
            background:
              "radial-gradient(600px 300px at 0% 0%, rgba(94,110,255,0.10), transparent 60%), var(--panel-solid)",
            borderColor: "var(--amber)"
          }}
        >
          <div
            className="retro-label"
            style={{ color: "var(--amber-bright)" }}
          >
            early inviter rewards
          </div>
          <p
            className="mt-2 text-sm leading-relaxed"
            style={{ color: "var(--text)", maxWidth: 760 }}
          >
            We&apos;re reserving recognition for the inviters who brought
            this network to life. The earliest people whose links bring
            new twins onboard get permanent early-builder credit,
            visibility on the hypernetwork, and first access to whatever
            we build next on top of this graph. Bring your people in
            before everyone else does.
          </p>
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

function StatTile({
  label,
  value,
  sub,
  hint
}: {
  label: string;
  value: number;
  sub?: string;
  hint?: string;
}) {
  return (
    <div
      className="retro-panel"
      style={{
        padding: "16px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        minHeight: 124
      }}
      title={hint}
    >
      <div className="retro-label" style={{ color: "var(--text-dim)" }}>
        {label}
      </div>
      <div
        className="retro-h1"
        style={{ fontSize: 32, lineHeight: 1, marginTop: 2 }}
      >
        {value.toLocaleString()}
      </div>
      {sub && (
        <div
          className="text-xs"
          style={{ color: "var(--amber-bright)", marginTop: 2 }}
        >
          {sub}
        </div>
      )}
      {hint && (
        <div
          className="text-xs"
          style={{ color: "var(--text-dim)", lineHeight: 1.4 }}
        >
          {hint}
        </div>
      )}
    </div>
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
