import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Wordmark } from "../../Wordmark";
import { createCommunity } from "./actions";
import { NetworkDensity } from "../NetworkDensity";

export default async function NewCommunityPage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/communities/new");

  return (
    <main className="max-w-3xl mx-auto px-6 pt-4 pb-8">
      <div className="flex items-center justify-between">
        <Wordmark />
        <Link href="/dashboard" className="retro-dim text-xs">
          dashboard &gt;
        </Link>
      </div>

      {/* MANIFESTO */}
      <section className="mt-4">
        <div className="retro-label">sync a community</div>
        <h1 className="retro-h1 text-4xl sm:text-5xl mt-3 leading-tight">
          Increase the network density of your community.
        </h1>
        <p
          className="mt-5 text-base sm:text-lg leading-relaxed"
          style={{ color: "var(--text-dim)" }}
        >
          A community is just a group of nodes. The single biggest predictor
          of whether a community will compound — into deals, jobs, projects,
          friendships — is the density of real connections between its
          members. Most communities have low density: people share a
          Discord, a Slack, a group chat, an alumni list, but the
          high-leverage pairs never actually meet.
        </p>
        <p
          className="mt-4 text-base leading-relaxed"
          style={{ color: "var(--text-dim)" }}
        >
          SyncedIn raises density automatically. Every member onboards a
          twin. Every twin talks to every other twin. The win-wins surface
          as a ranked feed, so members walk into your community already
          knowing who to message, what to propose, and why.
        </p>

        <div className="mt-8">
          <NetworkDensity />
        </div>

        <div className="mt-16 grid sm:grid-cols-3 gap-3">
          <Pillar
            k="01"
            t="One private community link"
            d="Members join through your shareable URL. Only people inside it see each other in discovery."
          />
          <Pillar
            k="02"
            t="Twins run the cold-start"
            d="N² introductions happen silently. Members see a ranked shortlist of who they should actually talk to."
          />
          <Pillar
            k="03"
            t="Density compounds"
            d="Every new member adds N new potential pairings. The community becomes more useful with each signup, not less."
          />
        </div>
      </section>

      {/* FORM */}
      <section className="mt-16">
        <div className="retro-label">create your community</div>
        <h2 className="retro-h1 text-2xl mt-2">
          Spin up your community link.
        </h2>
        <p className="text-sm mt-2" style={{ color: "var(--text-dim)" }}>
          Get a private space at syncedin.org/communities/your-slug. Members
          join through that link and only see fellow members. Owner tools
          include bulk invite, QR code, and live density stats.
        </p>

        <form action={createCommunity} className="mt-6 space-y-4">
          <label className="block">
            <div className="text-sm font-semibold">Community name</div>
            <input
              name="name"
              required
              placeholder="Founders' Roundtable"
              className="retro-input mt-1"
            />
          </label>
          <label className="block">
            <div className="text-sm font-semibold">URL slug</div>
            <div className="flex items-center gap-1 mt-1">
              <span className="retro-dim text-xs">
                syncedin.org/communities/
              </span>
              <input
                name="slug"
                required
                pattern="[a-z0-9-]+"
                placeholder="founders-roundtable"
                className="retro-input flex-1"
              />
            </div>
          </label>
          <label className="block">
            <div className="text-sm font-semibold">
              One-line description (optional)
            </div>
            <input
              name="description"
              placeholder="A private network of operators in vertical SaaS."
              className="retro-input mt-1"
            />
          </label>
          <label className="block">
            <div className="text-sm font-semibold">City / region (optional)</div>
            <input
              name="city"
              placeholder="San Francisco, CA · global"
              className="retro-input mt-1"
            />
          </label>
          <button type="submit" className="retro-btn retro-btn-primary mt-2">
            + Create community
          </button>
        </form>
      </section>
    </main>
  );
}

function Pillar({ k, t, d }: { k: string; t: string; d: string }) {
  return (
    <div className="retro-panel p-4">
      <div className="retro-amber text-xs font-bold">{k}</div>
      <div className="mt-1 font-semibold text-sm">{t}</div>
      <div className="mt-1 retro-dim text-xs leading-relaxed">{d}</div>
    </div>
  );
}
