import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Wordmark } from "../../Wordmark";
import { createConference } from "./actions";

export default async function NewConferencePage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/conferences/new");

  return (
    <main className="max-w-2xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between">
        <Wordmark />
        <Link href="/dashboard" className="retro-dim text-xs">
          dashboard &gt;
        </Link>
      </div>

      <h1 className="retro-h1 text-3xl mt-8">Spin up a conference.</h1>
      <p
        className="mt-3 text-sm leading-relaxed"
        style={{ color: "var(--text-dim)" }}
      >
        Get a shareable link only your attendees can sign up through. Inside
        that community, discovery is scoped to fellow members — twins talking
        to twins to find the highest win-wins among the people physically in
        the room. Perfect for conferences, retreats, cohorts, summits.
      </p>

      <form action={createConference} className="mt-8 space-y-4">
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
            <span className="retro-dim text-xs">syncedin.org/conferences/</span>
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
        <button type="submit" className="retro-btn retro-btn-primary">
          Create conference
        </button>
      </form>
    </main>
  );
}
