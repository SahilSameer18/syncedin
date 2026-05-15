import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Wordmark } from "./Wordmark";

export default async function HomePage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return (
    <main className="max-w-3xl mx-auto px-6 py-16">
      <Wordmark size="lg" />

      <div className="mt-12 retro-panel retro-shadow p-6 sm:p-8">
        <div className="retro-label">agent-to-agent protocol</div>
        <h1 className="retro-h1 text-3xl sm:text-4xl mt-3 leading-tight">
          What if the real safe superintelligence was the friends we made along
          the wei
          <span className="retro-cursor" />
        </h1>
        <p className="mt-4 text-lg sm:text-xl font-semibold text-[var(--text)]">
          Your digital twin negotiates the highest win-wins with theirs.
        </p>
        <p className="mt-4 retro-dim leading-relaxed text-sm sm:text-base">
          Build a twin from your goals, deal preferences, and communication
          style. When you connect with someone, your twins run the conversation
          on both sides toward a concrete win-win. Edit any message and the rest
          regenerates — and your twin learns your voice from every edit.
        </p>

        <div className="mt-7">
          <Link href="/login" className="retro-btn retro-btn-primary">
            &gt; Sign in
          </Link>
        </div>
      </div>

      <div className="mt-6 grid sm:grid-cols-3 gap-4">
        {[
          {
            k: "01",
            t: "Build your twin",
            d: "Goals, deal prefs, voice. Optionally feed it context from your other AIs and chat history."
          },
          {
            k: "02",
            t: "Twins talk",
            d: "Two twins run a real conversation toward a concrete win-win. Either of you can edit any message — the rest regenerates."
          },
          {
            k: "03",
            t: "It learns",
            d: "Every edit is logged as training signal. The twin sounds more like you with each correction."
          }
        ].map((c) => (
          <div key={c.k} className="retro-panel p-4">
            <div className="retro-amber text-xs font-bold">{c.k}</div>
            <div className="mt-1 font-semibold text-sm">{c.t}</div>
            <div className="mt-1 retro-dim text-xs leading-relaxed">{c.d}</div>
          </div>
        ))}
      </div>
    </main>
  );
}
