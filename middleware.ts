import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

export async function middleware(request: NextRequest) {
  const earlyPath = request.nextUrl.pathname;
  // Hard short-circuit for OG/Twitter image routes and any static asset that
  // scrapers (iMessage LP, Twitter, Facebook, Slack) fetch. We DO NOT touch
  // supabase cookies for these — that's what poisons Cache-Control with
  // private/no-store and prevents Apple from caching the rich preview.
  if (
    earlyPath === "/opengraph-image" ||
    earlyPath === "/twitter-image" ||
    earlyPath.endsWith("/opengraph-image") ||
    earlyPath.endsWith("/twitter-image") ||
    earlyPath === "/robots.txt" ||
    earlyPath === "/sitemap.xml" ||
    earlyPath === "/manifest.json"
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

  // Explicit allowlist of PROTECTED top-level routes. Anything else (including
  // single-segment slug invite pages like /jason-lv) is public so that link
  // previewers (iMessage, Slack, Twitter, etc.) can scrape per-page OG tags
  // without being bounced to /login.
  const PROTECTED_PREFIXES = [
    "/dashboard",
    "/onboarding",
    "/conversations",
    "/messages",
    "/settings"
  ];
  const isProtected = PROTECTED_PREFIXES.some(
    (p) => path === p || path.startsWith(p + "/")
  );

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|jpg|jpeg|gif|webp)$).*)"]
};
