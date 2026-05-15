import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { saveTwin } from "./actions";
import { ExtractionGuides } from "./ExtractionGuides";
import { DumpTextarea } from "./DumpTextarea";
import { AiDumpHero } from "./AiDumpHero";
import { Wordmark } from "../Wordmark";

export default async function OnboardingPage({
  searchParams
}: {
  searchParams: { saved?: string };
}) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: twin } = await supabase
    .from("twin_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <main className="max-w-2xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between">
        <Wordmark />
        <Link href="/dashboard" className="retro-dim text-xs">
          dashboard &gt;
        </Link>
      </div>

      <h1 className="retro-h1 text-2xl mt-6">Build your twin</h1>
      <p className="mt-1 retro-dim text-sm">
        Two required fields and one paste. Everything else is optional.
      </p>

      {searchParams.saved === "1" && (
        <p className="mt-3 text-sm retro-green">✓ Saved.</p>
      )}

      <form action={saveTwin} className="mt-6 space-y-5">
        {/* HERO — the fast path */}
        <AiDumpHero />

        <label className="block">
          <div className="retro-label">paste your twin&apos;s context</div>
          <div className="text-xs retro-dim mt-1">
            Paste the AI&apos;s full answer here. Add chat exports or sent
            emails too if you have them — no length limit, more is better.
          </div>
          <DumpTextarea defaultValue={twin?.ai_export_blob ?? ""} />
        </label>

        {/* Required basics */}
        <Field
          label="Your name — how others see you"
          name="display_name"
          defaultValue={profile?.display_name ?? ""}
        />
        <Field
          label="Your goals — what are you trying to accomplish right now?"
          name="goals"
          defaultValue={twin?.goals ?? ""}
          textarea
          rows={3}
        />

        {/* Optional detail — collapsed by default to keep onboarding simple */}
        <details className="retro-panel">
          <summary className="px-4 py-3 cursor-pointer text-sm">
            <span className="retro-label">// add more detail (optional)</span>
            <span className="retro-dim text-xs ml-2">
              sharpens the twin — skip it and the paste above carries you
            </span>
          </summary>
          <div className="px-4 pb-4 space-y-5">
            <Field
              label="Deal preferences — what partnerships, deals, or intros do you want?"
              name="deal_preferences"
              defaultValue={twin?.deal_preferences ?? ""}
              textarea
              rows={2}
            />
            <Field
              label="Communication style — how do you write? (concise / warm / direct / formal)"
              name="communication_style"
              defaultValue={twin?.communication_style ?? ""}
              textarea
              rows={2}
            />
            <Field
              label="Deal breakers — what won't you do?"
              name="deal_breakers"
              defaultValue={twin?.deal_breakers ?? ""}
              textarea
              rows={2}
            />
            <div>
              <div className="retro-label">// other context sources</div>
              <div className="mt-2">
                <ExtractionGuides />
              </div>
            </div>
          </div>
        </details>

        <button className="retro-btn retro-btn-primary w-full">
          Save twin &amp; go to dashboard
        </button>
      </form>
    </main>
  );
}

function Field({
  label,
  name,
  defaultValue = "",
  textarea = false,
  rows = 3,
  placeholder = ""
}: {
  label: string;
  name: string;
  defaultValue?: string;
  textarea?: boolean;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <div className="text-sm text-[var(--text)]">{label}</div>
      {textarea ? (
        <textarea
          name={name}
          defaultValue={defaultValue}
          rows={rows}
          placeholder={placeholder}
          className="retro-input mt-1.5 text-sm"
        />
      ) : (
        <input
          name={name}
          defaultValue={defaultValue}
          placeholder={placeholder}
          className="retro-input mt-1.5 text-sm"
        />
      )}
    </label>
  );
}
