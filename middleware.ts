import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

export async function middleware(request: NextRequest) {
  const earlyPath = request.nextUrl.pathname;
  if (
    earlyPath === "/opengraph-image" ||
    earlyPath === "/twitter-image" ||
    earlyPath.endsWith("/opengraph-image") ||
    earlyPath.endsWith("/twitter-image") ||
    earlyPath === "/robots.txt" ||
    earlyPath === "/sitemap.xml" ||
    earlyPath === "/manifest.json" ||
    earlyPath.startsWith("/api/") ||
    /^\/[a-zA-Z0-9]+\.txt$/.test(earlyPath)
  ) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        }
      }
    }
  );

  const {
    data: { user }
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  // Protect sensitive user routes: require login authentication for Match Lab,
  // Twin editor, Dashboard, Messages, and Settings.
  const PROTECTED_PREFIXES = [
    "/dashboard",
    "/onboarding",
    "/conversations",
    "/messages",
    "/settings",
    "/match-lab",
    "/twin"
  ];
  const isProtected = PROTECTED_PREFIXES.some(
    (p) => path === p || path.startsWith(p + "/")
  );

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  if (!user && path === "/") {
    const AB_COOKIE = "syncedin_landing_ab";
    let variant = request.cookies.get(AB_COOKIE)?.value;
    if (variant !== "a" && variant !== "b") {
      variant = Math.random() < 0.5 ? "a" : "b";
      response.cookies.set(AB_COOKIE, variant, {
        path: "/",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30
      });
    }
    if (variant === "b") {
      const url = request.nextUrl.clone();
      url.pathname = "/talk";
      return NextResponse.redirect(url);
    }
  }

  if (user) {
    const STAMP_COOKIE = "syncedin_last_stamp";
    const DEBOUNCE_MS = 5 * 60 * 1000;
    const cookieVal = request.cookies.get(STAMP_COOKIE)?.value;
    const lastStampMs = cookieVal ? Number(cookieVal) : 0;
    const now = Date.now();
    if (!lastStampMs || now - lastStampMs > DEBOUNCE_MS) {
      response.cookies.set(STAMP_COOKIE, String(now), {
        path: "/",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30
      });
      void (async () => {
        try {
          await supabase
            .from("profiles")
            .update({ last_active_at: new Date(now).toISOString() })
            .eq("id", user.id);
        } catch {
          /* column miss skip */
        }
      })();
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|jpg|jpeg|gif|webp)$).*)"]
};
