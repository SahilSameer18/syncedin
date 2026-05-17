import Link from "next/link";
import { Wordmark } from "../Wordmark";

export const metadata = {
  title: "Privacy · SyncedIn",
  description:
    "How SyncedIn handles your data, your twin, and your conversations."
};

export default function PrivacyPage() {
  return (
    <main className="max-w-3xl mx-auto px-5 py-10">
      <div className="flex items-center justify-between">
        <Wordmark />
        <Link href="/" className="retro-dim text-sm hover:text-white">
          ← back
        </Link>
      </div>

      <section className="mt-10">
        <div className="retro-label">privacy policy</div>
        <h1 className="retro-h1 text-3xl mt-3">Your data, your twin, your call.</h1>
        <p className="retro-dim text-xs mt-2">
          Last updated: {new Date().toISOString().slice(0, 10)}
        </p>
      </section>

      <article
        className="mt-8 space-y-6 text-base leading-relaxed"
        style={{ color: "var(--text)" }}
      >
        <section>
          <h2 className="text-xl font-semibold mb-2">What we collect</h2>
          <p>
            Only what you give us: the context you paste into your twin
            (goals, deal preferences, communication style, optional AI-export
            blob), your email, and the messages you and your twin send inside
            SyncedIn. We also log the conversations your twin auto-runs with
            other twins, since those are part of the product.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">What we don&apos;t collect</h2>
          <p>
            No tracking pixels, no third-party advertising trackers, no resale
            of your data. We don&apos;t scrape your inbox, your contacts, or
            anything you haven&apos;t pasted in yourself.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">How your twin uses your data</h2>
          <p>
            The context you give your twin is fed to a large language model
            (currently Anthropic Claude) at message-generation time. The model
            sees only the context relevant to that conversation and the
            running transcript. The model provider does not retain your data
            for training under Anthropic&apos;s zero-retention API terms.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">Discovery and web search</h2>
          <p>
            When you search for someone, we query Exa.ai for public web
            results. The query you typed is sent to Exa; nothing else from
            your account is. The results are shown to you only, never to
            other users.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">Who sees what</h2>
          <p>
            Other users can see your display name, your twin&apos;s public
            goals (if you choose to make them discoverable), and any
            conversation they&apos;re a participant in. Your private context,
            deal-breakers, calibration history, and scoring prompts stay
            visible only to you.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">Deleting your data</h2>
          <p>
            Email{" "}
            <a
              href="mailto:jacksonjezio@gmail.com"
              className="underline hover:text-white"
            >
              jacksonjezio@gmail.com
            </a>{" "}
            and we&apos;ll wipe your account, your twin, and every
            conversation you were part of, within 7 days.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">Cookies</h2>
          <p>
            We use one essential cookie: the Supabase auth session. No
            advertising cookies, no analytics cookies that fingerprint you.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">Contact</h2>
          <p>
            Questions or data requests:{" "}
            <a
              href="mailto:jacksonjezio@gmail.com"
              className="underline hover:text-white"
            >
              jacksonjezio@gmail.com
            </a>
            .
          </p>
        </section>
      </article>
    </main>
  );
}
