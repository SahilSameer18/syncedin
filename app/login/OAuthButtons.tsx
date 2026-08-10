"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

function GoogleLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 18 18" aria-hidden="true" className="shrink-0">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.836.86-3.048.86-2.345 0-4.328-1.584-5.036-3.71H.957v2.332A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC04"
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A9.005 9.005 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A9 9 0 0 0 .957 4.958L3.964 7.29C4.672 5.164 6.655 3.58 9 3.58z"
      />
    </svg>
  );
}

export function OAuthButtons({
  invite,
  conference,
  next
}: {
  invite?: string;
  conference?: string;
  next?: string;
}) {
  const [busy, setBusy] = useState<"google" | null>(null);
  const [err, setErr] = useState<string>("");

  function callbackUrl(): string {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const params = new URLSearchParams();
    if (next && next.startsWith("/")) {
      params.set("next", next);
    } else if (invite && /^[a-z0-9-]+$/i.test(invite)) {
      params.set("next", `/claim/${invite.toLowerCase()}`);
    } else if (conference && /^[a-z0-9-]+$/i.test(conference)) {
      params.set("next", `/conferences/${conference.toLowerCase()}/join`);
    }
    const qs = params.toString();
    return `${origin}/auth/callback${qs ? `?${qs}` : ""}`;
  }

  async function go(provider: "google") {
    setErr("");
    setBusy(provider);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: callbackUrl() }
      });
      if (error || !data?.url) {
        throw new Error(error?.message || `${provider} sign-in failed`);
      }
      window.location.href = data.url;
    } catch (e: any) {
      setErr(e?.message || "Sign-in failed");
      setBusy(null);
    }
  }

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={() => go("google")}
        disabled={busy !== null}
        className="w-full h-12 rounded-2xl bg-white border border-slate-200 hover:border-purple-300 text-slate-800 font-bold text-sm flex items-center justify-center gap-3 shadow-sm hover:shadow-md transition-all disabled:opacity-50"
      >
        <GoogleLogo />
        <span>{busy === "google" ? "Connecting to Google…" : "Continue with Google"}</span>
      </button>

      {err && (
        <div className="mt-2 text-xs text-rose-500 font-medium text-center break-words">
          {err}
        </div>
      )}
    </div>
  );
}
