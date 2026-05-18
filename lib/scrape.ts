/**
 * Public-profile scraper chain.
 *
 * Strategy: try Exa first (cheap, works for most LinkedIn / Substack / blogs),
 * then fall back to Apify actors for X / Instagram which Exa can't reach
 * because those sites require auth or block headless browsers.
 *
 * Env vars (optional — each tier degrades gracefully if missing):
 *   EXA_API_KEY      — already used by lib/exa
 *   APIFY_TOKEN      — for the Apify run-sync-get-dataset-items endpoint
 *
 * Apify actors used (run-sync-get-dataset-items hits them by slug):
 *   - apify/twitter-scraper           (X / Twitter, public timelines + profile)
 *   - apify/instagram-profile-scraper (Instagram public profiles)
 *
 * If everything fails we surface the raw error so the UI can fall back to
 * the manual paste path.
 */

import { exaGetContents } from "@/lib/exa";

const APIFY_TOKEN = process.env.APIFY_TOKEN;

function isXUrl(url: string): boolean {
  return /(?:^|\/\/)(?:www\.)?(?:twitter|x)\.com\//i.test(url);
}
function isInstagramUrl(url: string): boolean {
  return /(?:^|\/\/)(?:www\.)?instagram\.com\//i.test(url);
}

function handleFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const segs = u.pathname.split("/").filter(Boolean);
    return segs[0] || null;
  } catch {
    return null;
  }
}

async function apifyRun(
  actor: string,
  input: Record<string, unknown>,
  timeoutSec = 45
): Promise<unknown[]> {
  if (!APIFY_TOKEN) {
    throw new Error("APIFY_TOKEN missing");
  }
  // run-sync-get-dataset-items: kicks off the actor and waits for output in
  // one HTTP call. Slug must be the dotless form (org~name).
  const slug = actor.replace("/", "~");
  const url =
    `https://api.apify.com/v2/acts/${slug}/run-sync-get-dataset-items` +
    `?token=${encodeURIComponent(APIFY_TOKEN)}` +
    `&timeout=${timeoutSec}&memory=1024&format=json`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input)
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `Apify ${actor} failed (HTTP ${res.status}): ${detail.slice(0, 200)}`
    );
  }
  const data = (await res.json()) as unknown;
  return Array.isArray(data) ? data : [];
}

function flatten(value: unknown, depth = 0): string {
  if (depth > 4) return "";
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map((v) => flatten(v, depth + 1)).join("\n");
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => `${k}: ${flatten(v, depth + 1)}`)
      .join("\n");
  }
  return "";
}

async function scrapeXProfile(url: string): Promise<string> {
  const handle = handleFromUrl(url);
  if (!handle) throw new Error("Could not parse X handle from URL");
  // apidojo/tweet-scraper is the most-used X scraper actor; takes a profile URL.
  const items = await apifyRun("apidojo/tweet-scraper", {
    twitterHandles: [handle],
    maxItems: 25,
    sort: "Latest"
  });
  if (items.length === 0) {
    throw new Error("Apify returned no items for X profile");
  }
  // Each item is a tweet object. Pull text + author bio if available.
  const bio = (items[0] as any)?.author?.description ?? "";
  const tweets = items
    .map((t) => (t as any)?.text ?? "")
    .filter(Boolean)
    .slice(0, 25)
    .join("\n• ");
  return `@${handle} on X\n\nBio: ${bio}\n\nRecent posts:\n• ${tweets}`;
}

async function scrapeInstagramProfile(url: string): Promise<string> {
  const handle = handleFromUrl(url);
  if (!handle) throw new Error("Could not parse Instagram handle from URL");
  const items = await apifyRun("apify/instagram-profile-scraper", {
    usernames: [handle]
  });
  if (items.length === 0) {
    throw new Error("Apify returned no items for Instagram profile");
  }
  const p = items[0] as Record<string, unknown>;
  // Common fields: fullName, biography, followersCount, postsCount, latestPosts
  return flatten(
    {
      handle: `@${handle}`,
      fullName: p.fullName,
      biography: p.biography,
      external_url: p.externalUrl ?? p.external_url,
      followers: p.followersCount,
      posts: p.postsCount,
      latestPosts: Array.isArray(p.latestPosts)
        ? (p.latestPosts as any[])
            .slice(0, 8)
            .map((lp) => lp?.caption)
            .filter(Boolean)
        : []
    },
    0
  );
}

/**
 * Try Exa first. If it returns empty (very common for X / Instagram), and
 * the URL is from a platform Apify can reach, fall back to Apify. If
 * everything fails, throw — caller surfaces a "paste it manually" hint.
 */
export async function scrapePublicProfile(url: string): Promise<string> {
  // 1. Exa
  let exaText = "";
  try {
    exaText = await exaGetContents(url);
  } catch {
    /* fall through */
  }
  if (exaText && exaText.trim().length > 80) {
    return exaText;
  }

  // 2. Apify per-platform fallbacks
  if (isXUrl(url) && APIFY_TOKEN) {
    try {
      return await scrapeXProfile(url);
    } catch (e) {
      console.warn("[scrape] X via Apify failed", e);
    }
  }
  if (isInstagramUrl(url) && APIFY_TOKEN) {
    try {
      return await scrapeInstagramProfile(url);
    } catch (e) {
      console.warn("[scrape] Instagram via Apify failed", e);
    }
  }

  // 3. Surface whatever Exa returned (even if short) — better than nothing.
  if (exaText && exaText.trim().length > 0) return exaText;

  const tip = APIFY_TOKEN
    ? "Couldn't reach that profile from any scraper. Paste a few sentences manually instead."
    : "X and Instagram block automated fetches. Add APIFY_TOKEN to enable the fallback scraper, or paste a few sentences manually.";
  throw new Error(tip);
}
