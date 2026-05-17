import Link from "next/link";
import {
  login,
  signInWithPassword,
  signUpWithPassword,
  signInWithGoogle,
  signInWithApple
} from "./actions";
import { Wordmark } from "../Wordmark";

// Google "G" logo — official multi-color inline SVG.
function GoogleLogo() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      width="20"
      height="20"
      style={{ flexShrink: 0 }}
      aria-hidden
    >
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}

// Apple logo — single-color inline SVG.
function AppleLogo() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      style={{ flexShrink: 0 }}
      aria-hidden
    >
      <path
        fill="currentColor"
        d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.08zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"
      />
    </svg>
  );
}

export default function LoginPage({
  searchParams
}: {
  searchParams: { sent?: string; error?: string; detail?: string; invite?: string };
}) {
  const sent = searchParams.sent === "1";
  const detail = searchParams.detail
    ? decodeURIComponent(searchParams.detail)
    : null;

  return (
    <main className="max-w-md mx-auto px-5 py-10">
      <Link href="/" className="retro-dim text-xs">
        &lt; back
      </Link>

      <div className="mt-4 retro-panel retro-shadow p-6 sm:p-8">
        {/* Big logo + tagline */}
        <div className="flex flex-col items-center text-center">
          <Wordmark size="xl" />
          <h1
            className="retro-h1 text-2xl sm:text-3xl mt-4 leading-tight"
            style={{ letterSpacing: "-0.02em" }}
          >
            Join the platform of the future
          </h1>
          <p
            className="mt-3 text-sm"
            style={{ color: "var(--text-dim)" }}
          >
            Use Google or Apple for the fastest path, or email + magic
            link, or email + password.
          </p>
        </div>

        {/* Magic link FIRST */}
        <form className="mt-7 space-y-3">
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@domain.com"
            className="retro-input"
          />
          <button
            formAction={login}
            className="retro-btn retro-btn-primary w-full"
          >
            Email me a magic link
          </button>
        </form>

        {sent && (
          <p className="mt-3 text-sm retro-green text-center">
            ✓ Check your inbox — the link works in any browser.
          </p>
        )}

        <div className="my-6 flex items-center gap-3">
          <div className="flex-1 h-px bg-[var(--border)]" />
          <span className="retro-label">or</span>
          <div className="flex-1 h-px bg-[var(--border)]" />
        </div>

        {/* OAuth with brand logos */}
        <div className="space-y-2">
          <form action={signInWithGoogle}>
            <button className="retro-btn w-full flex items-center justify-center gap-3">
              <GoogleLogo />
              <span>Continue with Google</span>
            </button>
          </form>
          <form action={signInWithApple}>
            <button className="retro-btn w-full flex items-center justify-center gap-3">
              <AppleLogo />
              <span>Continue with Apple</span>
            </button>
          </form>
        </div>

        <div className="my-6 flex items-center gap-3">
          <div className="flex-1 h-px bg-[var(--border)]" />
          <span className="retro-label">or password</span>
          <div className="flex-1 h-px bg-[var(--border)]" />
        </div>

        {/* Email + password as the third option */}
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
              className="retro-btn flex-1"
            >
              Sign in
            </button>
            <button
              formAction={signUpWithPassword}
              className="retro-btn flex-1"
            >
              Create account
            </button>
          </div>
        </form>

        {searchParams.error && (
          <div
            className="mt-5 p-3 retro-panel"
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

      <p
        className="mt-5 retro-dim text-[11px] text-center leading-relaxed"
        style={{ color: "var(--text-dim)" }}
      >
        Magic links work in any browser. Google &amp; Apple sign-in require
        their providers enabled in Supabase.
      </p>
    </main>
  );
}
