import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Supabase magic-link / OAuth callback.
// Handles both PKCE (?code=...) and OTP token_hash (?token_hash=...&type=...).
// Surfaces the real error to /login so failures aren't a black box.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  // Land signed-in users straight on the dashboard. The dashboard itself
  // nudges anyone who hasn't finished their twin over to /onboarding.
  const next = searchParams.get("next") ?? "/dashboard";

  const supabase = createClient();
  let errMsg = "";

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
    errMsg = error.message;
  } else if (token_hash) {
    // token_hash links work in ANY browser (no PKCE verifier needed).
    // The OTP `type` varies by Supabase version — try the likely ones.
    const candidates = [type, "email", "magiclink", "signup"].filter(
      Boolean
    ) as string[];
    for (const t of candidates) {
      const { error } = await supabase.auth.verifyOtp({
        token_hash,
        type: t as any
      });
      if (!error) return NextResponse.redirect(`${origin}${next}`);
      errMsg = error.message;
    }
  } else {
    errMsg = "The sign-in link had no auth token — it may have been mangled by your email client. Request a fresh one.";
  }

  const detail = encodeURIComponent(errMsg || "unknown callback error");
  return NextResponse.redirect(
    `${origin}/login?error=callback&detail=${detail}`
  );
}
