import Link from "next/link";
import {
  login,
  signInWithPassword,
  signUpWithPassword,
  signInWithGoogle,
  signInWithApple
} from "./actions";
import { Wordmark } from "../Wordmark";

export default function LoginPage({
  searchParams
}: {
  searchParams: { sent?: string; error?: string; detail?: string };
}) {
  const sent = searchParams.sent === "1";
  const detail = searchParams.detail
    ? decodeURIComponent(searchParams.detail)
    : null;

  return (
    <main className="max-w-md mx-auto px-6 py-16">
      <Link href="/" className="retro-dim text-xs">
        &lt; back
      </Link>

      <div className="mt-6 retro-panel retro-shadow p-6">
        <Wordmark />
        <h1 className="retro-h1 text-xl mt-5">Sign in</h1>
        <p className="mt-1 retro-dim text-sm">
          Use Google or Apple for the fastest path — or email + password.
        </p>

        {/* OAuth */}
        <div className="mt-5 space-y-2">
          <form action={signInWithGoogle}>
            <button className="retro-btn w-full">Continue with Google</button>
          </form>
          <form action={signInWithApple}>
            <button className="retro-btn w-full">Continue with Apple</button>
          </form>
        </div>

        <div className="my-5 flex items-center gap-3">
          <div className="flex-1 h-px bg-[var(--border)]" />
          <span className="retro-label">or</span>
          <div className="flex-1 h-px bg-[var(--border)]" />
        </div>

        {/* Email + password — one form, multiple submit targets */}
        <form className="space-y-3">
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@domain.com"
            className="retro-input"
          />
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="password (8+ characters)"
            className="retro-input"
          />
          <div className="flex gap-2">
            <button
              formAction={signInWithPassword}
              className="retro-btn retro-btn-primary flex-1"
            >
              Sign in
            </button>
            <button formAction={signUpWithPassword} className="retro-btn flex-1">
              Create account
            </button>
          </div>
          <button formAction={login} className="retro-btn w-full">
            Email me a magic link
          </button>
        </form>

        {sent && (
          <p className="mt-4 text-sm retro-green">
            ✓ Check your inbox — the link works in any browser.
          </p>
        )}
        {searchParams.error && (
          <div
            className="mt-4 p-3 retro-panel"
            style={{ borderColor: "var(--red)" }}
          >
            <p className="text-sm retro-red font-semibold">
              ! Something went wrong
            </p>
            {detail && (
              <p className="mt-1 text-xs retro-dim break-words">{detail}</p>
            )}
          </div>
        )}
      </div>

      <p className="mt-4 retro-dim text-[11px] text-center leading-relaxed">
        Magic links now work even if you open them in a different browser.
        Google &amp; Apple sign-in need their providers enabled in Supabase.
      </p>
    </main>
  );
}
