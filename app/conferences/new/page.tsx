import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createConference } from "./actions";
import { AppShell } from "../../AppShell";

export default async function NewConferencePage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/conferences/new");

  return (
    <AppShell>
      {/* MANIFESTO HERO */}
      <section className="mt-4">
        <div className="retro-label">sync a conference</div>
        <h1 className="retro-h1 text-4xl sm:text-5xl mt-3 leading-tight">
          Build the strongest inner-network of your life.
        </h1>
        <p
          className="mt-5 text-base sm:text-lg leading-relaxed"
          style={{ color: "var(--text-dim)" }}
        >
          The most leveraged thing you can do for a community is help its
          members find each other. Conferences, cohorts, residencies, and
          retreats are loose collections of brilliant people who mostly never
          talk to the right counterpart in the room. SyncedIn fixes that.
        </p>
        <p
          className="mt-4 text-base leading-relaxed"
          style={{ color: "var(--text-dim)" }}
        >
          Every attendee builds a twin. Every twin talks to every other twin
          in parallel. Win-wins surface as a ranked list. Each person walks
          in already knowing the three people they should sit next to, and
          why.
        </p>

        {/* Diagram: scattered nodes vs SyncedIn matched */}
        <div className="mt-8">
          <NetworkComparison />
        </div>

        {/* Three concrete pillars */}
        <div className="mt-10 grid sm:grid-cols-3 gap-3">
          <Pillar
            k="01"
            t="Every attendee onboards a twin"
            d="A 5-minute self-portrait — goals, voice, deal preferences. Their clone is ready before the venue doors open."
          />
          <Pillar
            k="02"
            t="Twins meet in parallel"
            d="N² conversations run silently. The platform surfaces the matches your attendees would have spent the whole event hunting for."
          />
          <Pillar
            k="03"
            t="Humans only see what matters"
            d="A short list of pre-vetted win-wins per person. Hallway-track signal without the hallway-track tax."
          />
        </div>
      </section>

      {/* FORM */}
      <section className="mt-16">
        <div className="retro-label">create your conference</div>
        <h2 className="retro-h1 text-2xl mt-2">
          Spin up your shareable link.
        </h2>
        <p className="text-sm mt-2" style={{ color: "var(--text-dim)" }}>
          Get a private community at syncedin.org/conferences/your-slug. Only
          people who join via that link see each other. Owner tools include
          bulk invite, QR code for in-person check-in, and live attendee stats.
        </p>

        <form action={createConference} className="mt-6 space-y-4">
          <label className="block">
            <div className="text-sm font-semibold">Conference name</div>
            <input
              name="name"
              required
              placeholder="DevCon 2026"
              className="retro-input mt-1"
            />
          </label>
          <label className="block">
            <div className="text-sm font-semibold">URL slug</div>
            <div className="flex items-center gap-1 mt-1">
              <span className="retro-dim text-xs">
                syncedin.org/conferences/
              </span>
              <input
                name="slug"
                required
                pattern="[a-z0-9-]+"
                placeholder="devcon-2026"
                className="retro-input flex-1"
              />
            </div>
            <p className="text-xs mt-1 retro-dim">
              Lowercase letters, digits, dashes. This becomes the shareable
              join link.
            </p>
          </label>
          <label className="block">
            <div className="text-sm font-semibold">
              One-line description (optional)
            </div>
            <input
              name="description"
              placeholder="The annual gathering of agentic-protocol builders."
              className="retro-input mt-1"
            />
          </label>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block">
              <div className="text-sm font-semibold">Starts</div>
              <input
                name="starts_at"
                type="date"
                className="retro-input mt-1"
              />
            </label>
            <label className="block">
              <div className="text-sm font-semibold">Ends</div>
              <input
                name="ends_at"
                type="date"
                className="retro-input mt-1"
              />
            </label>
          </div>
          <label className="block">
            <div className="text-sm font-semibold">City (optional)</div>
            <input
              name="city"
              placeholder="San Francisco, CA"
              className="retro-input mt-1"
            />
          </label>
          <button type="submit" className="retro-btn retro-btn-primary mt-2">
            + Create conference
          </button>
        </form>
      </section>
    </AppShell>
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

/**
 * NetworkComparison — two side-by-side SVGs:
 *  - LEFT: scattered, disconnected attendee nodes (the conference today)
 *  - RIGHT: same nodes, but twin-discovered edges connect high-leverage pairs
 *    plus a glowing "win-win" label on each strongest match
 */
function NetworkComparison() {
  // Deterministic node positions (no Math.random at SSR — so it doesn't shift
  // between server and client). 14 attendees, evenly distributed on the right;
  // scattered jittered on the left.
  const N = 14;
  const left: Array<{ x: number; y: number }> = [
    { x: 60, y: 50 },
    { x: 140, y: 30 },
    { x: 220, y: 70 },
    { x: 280, y: 40 },
    { x: 320, y: 110 },
    { x: 80, y: 130 },
    { x: 180, y: 160 },
    { x: 250, y: 200 },
    { x: 100, y: 200 },
    { x: 320, y: 220 },
    { x: 60, y: 260 },
    { x: 160, y: 280 },
    { x: 240, y: 270 },
    { x: 300, y: 290 }
  ];
  // Right: same N attendees in a clean ring, with a few "win-win" edges.
  const cx = 190;
  const cy = 170;
  const r = 130;
  const right = Array.from({ length: N }, (_, i) => {
    const t = (i / N) * Math.PI * 2 - Math.PI / 2;
    return { x: cx + Math.cos(t) * r, y: cy + Math.sin(t) * r };
  });
  // Edges in the connected graph — only the high-leverage pairs (twin
  // discovered "win-wins"), not the full mesh.
  const edges: Array<[number, number]> = [
    [0, 6],
    [2, 9],
    [4, 11],
    [1, 8],
    [3, 12],
    [5, 13],
    [7, 10]
  ];

  return (
    <div
      className="retro-panel"
      style={{ padding: 16, background: "var(--panel-solid)" }}
    >
      <div className="grid sm:grid-cols-2 gap-4 items-stretch">
        {/* LEFT — disconnected */}
        <div>
          <div
            className="retro-label text-center"
            style={{ color: "var(--text-dim)" }}
          >
            Conference today
          </div>
          <svg
            viewBox="0 0 380 340"
            width="100%"
            height="auto"
            role="img"
            aria-label="Scattered, disconnected attendees"
          >
            {left.map((p, i) => (
              <g key={i}>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={9}
                  fill="var(--panel-2)"
                  stroke="var(--border-bright)"
                  strokeWidth={1.5}
                />
                <circle cx={p.x} cy={p.y - 3} r={3.5} fill="var(--text-dim)" />
                <path
                  d={`M ${p.x - 5} ${p.y + 5} Q ${p.x} ${p.y + 1} ${p.x + 5} ${p.y + 5}`}
                  fill="none"
                  stroke="var(--text-dim)"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                />
              </g>
            ))}
          </svg>
          <p
            className="retro-dim text-xs mt-2 text-center"
            style={{ lineHeight: 1.5 }}
          >
            Hundreds of brilliant people in the same room. Most never find the
            counterpart they should have spent an hour with.
          </p>
        </div>

        {/* RIGHT — connected via twins */}
        <div>
          <div
            className="retro-label text-center"
            style={{ color: "var(--amber-bright)" }}
          >
            Conference on SyncedIn
          </div>
          <svg
            viewBox="0 0 380 340"
            width="100%"
            height="auto"
            role="img"
            aria-label="Same attendees connected by twin-discovered win-wins"
          >
            <defs>
              <linearGradient id="edge_g" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="var(--amber)" />
                <stop offset="100%" stopColor="var(--amber-bright)" />
              </linearGradient>
              <radialGradient id="glow_g" cx="0.5" cy="0.5" r="0.5">
                <stop offset="0%" stopColor="var(--amber-bright)" stopOpacity="0.4" />
                <stop offset="100%" stopColor="var(--amber-bright)" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* Glow halos behind matched nodes */}
            {edges.flat().map((idx, k) => {
              const p = right[idx];
              return (
                <circle
                  key={`g${k}`}
                  cx={p.x}
                  cy={p.y}
                  r={22}
                  fill="url(#glow_g)"
                />
              );
            })}

            {/* Edges: win-win pairs */}
            {edges.map(([a, b], i) => (
              <line
                key={`e${i}`}
                x1={right[a].x}
                y1={right[a].y}
                x2={right[b].x}
                y2={right[b].y}
                stroke="url(#edge_g)"
                strokeWidth={2}
                strokeLinecap="round"
                opacity={0.85}
              />
            ))}

            {/* Nodes */}
            {right.map((p, i) => {
              const matched = edges.flat().includes(i);
              return (
                <g key={i}>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={11}
                    fill={matched ? "var(--panel-solid)" : "var(--panel-2)"}
                    stroke={
                      matched ? "var(--amber-bright)" : "var(--border-bright)"
                    }
                    strokeWidth={matched ? 2 : 1.5}
                  />
                  <circle
                    cx={p.x}
                    cy={p.y - 3}
                    r={4}
                    fill={matched ? "var(--amber)" : "var(--text-dim)"}
                  />
                  <path
                    d={`M ${p.x - 5} ${p.y + 5} Q ${p.x} ${p.y + 1} ${p.x + 5} ${p.y + 5}`}
                    fill="none"
                    stroke={matched ? "var(--amber)" : "var(--text-dim)"}
                    strokeWidth={1.5}
                    strokeLinecap="round"
                  />
                </g>
              );
            })}
          </svg>
          <p
            className="retro-dim text-xs mt-2 text-center"
            style={{ lineHeight: 1.5 }}
          >
            Twins find the high-leverage pairings before anyone arrives. Each
            human walks in with a ranked shortlist of who to talk to and what
            to talk about.
          </p>
        </div>
      </div>
    </div>
  );
}
