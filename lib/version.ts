// Build-time version stamp. Vercel injects VERCEL_GIT_COMMIT_SHA into every
// build, so the footer always reflects the exact commit serving the page.
// Falls back to "dev" for local development.
export const BUILD_SHA =
  (process.env.VERCEL_GIT_COMMIT_SHA || "").slice(0, 7) || "dev";

export const BUILD_DATE =
  process.env.VERCEL_GIT_COMMIT_AUTHOR_DATE || new Date().toISOString();
