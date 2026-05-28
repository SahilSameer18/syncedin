import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createCommunity } from "./actions";
import { NetworkDensity } from "../NetworkDensity";
import { AppShell } from "../../AppShell";
import { BrandScrapeFields } from "../../conferences/BrandScrapeFields";

export default async function NewCommunityPage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/communities/new");

  return (
    <AppShell>
      {/* MANIFESTO — shrunk so the NetworkDensity animation lands
          above-the-fold. Jack: "we can make this element a bit smaller
          so that that whole part is viewable without scrolling." */}
      <section className="mt-2">
        <div className="retro-label">sync a community</div>
        <h1 className="retro-h1 text-2xl sm:text-3xl mt-2 leading-tight">
          Increase the network density of your community.
        </h1>
        <p
          className="mt-2 text-sm sm:text-base leading-relaxed"
          style={{ color: "var(--text-dim)" }}
        >
          The single biggest predictor of a community compounding into deals,
          jobs, and projects is the density of real connections between
          members. SyncedIn raises that automatically — every member onboards
          a twin, every twin talks to every other twin in parallel, and the
          win-wins surface as a ranked feed.
        </p>

        <div className="mt-4">
          <NetworkDensity
            slowLabel="Today · speed of human bandwidth"
            fastLabel="On SyncedIn · speed of light"
            slowCaption="Members trickle through one DM, one event, one intro at a time. Most of the high-leverage pairs in your community never connect."
            fastCaption="Twins talk in parallel 24/7. The community's network density compounds with every new member."
            tagline={
              <>
                Density compounds,{" "}
                <span style={{ color: "var(--amber-bright)" }}>
                  forever
                </span>
                .
              </>
            }
          />
        </div>

        <div className="mt-16 grid sm:grid-cols-3 gap-5">
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
          {/* Brand-scrape: paste a URL → auto-fill name + description +
              logo + brand color. #156. */}
          <BrandScrapeFields />
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
