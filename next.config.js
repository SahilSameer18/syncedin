/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Friendly redirects for press-style URLs people guess at — the
  // canonical launch article lives at /article, but /press, /launch,
  // /story, /blog, and the original /articles/syncedin-launch.md path
  // should all land there too.
  async redirects() {
    return [
      { source: "/press", destination: "/article", permanent: false },
      { source: "/launch", destination: "/article", permanent: false },
      { source: "/story", destination: "/article", permanent: false },
      // /blog now has its own real index page — do NOT redirect.
      { source: "/articles", destination: "/blog", permanent: false },
      { source: "/articles/syncedin-launch", destination: "/article", permanent: true },
      { source: "/articles/syncedin-launch.md", destination: "/article", permanent: true }
    ];
  },
  env: {
    // Mirror Vercel's build-time system env vars into the client bundle.
    // Without this Next 14's client components see `undefined` for
    // process.env.VERCEL_GIT_COMMIT_SHA and the Footer falls back to
    // "dev" forever — so users had no way to tell which build was live.
    // Inlined here as a compile-time constant baked into the JS bundle.
    NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA:
      process.env.VERCEL_GIT_COMMIT_SHA || "",
    NEXT_PUBLIC_VERCEL_GIT_COMMIT_AUTHOR_DATE:
      process.env.VERCEL_GIT_COMMIT_AUTHOR_DATE || ""
  }
};
module.exports = nextConfig;
