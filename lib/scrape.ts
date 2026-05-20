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
// ScrapingDog: a fully separate provider with dedicated IG + X profile
// endpoints. Used as a second vendor (real cross-provider redundancy, not
// just a different Apify actor). Sign up at scrapingdog.com → copy API key
// → set SCRAPINGDOG_API_KEY in Vercel env. If the key is unset, this whole
// branch is skipped silently and we fall back to Apify alone.
const SCRAPINGDOG_API_KEY = process.env.SCRAPINGDOG_API_KEY;

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

/**
 * ScrapingDog Instagram profile endpoint — independent vendor (not Apify).
 * Docs: https://docs.scrapingdog.com/instagram-scraper/instagram-profile
 *
 * Returns the profile + recent posts as one JSON blob. We flatten the
 * useful bits (bio, follower count, external_url, post captions, profile
 * image URL) into a single text payload for the LLM.
 */
async function scrapingDogInstagram(handle: string): Promise<string> {
  if (!SCRAPINGDOG_API_KEY) throw new Error("SCRAPINGDOG_API_KEY missing");
  const url = `https://api.scrapingdog.com/instagram/profile?api_key=${encodeURIComponent(
    SCRAPINGDOG_API_KEY
  )}&username=${encodeURIComponent(handle)}`;
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) {
    throw new Error(
      `ScrapingDog IG ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`
    );
  }
  const j = (await res.json()) as Record<string, unknown>;
  // ScrapingDog wraps the actual profile under various keys depending on
  // API version — try them all defensively.
  const p =
    (j.profile as Record<string, unknown>) ||
    (j.data as Record<string, unknown>) ||
    (j.user as Record<string, unknown>) ||
    j;
  const fullName =
    (p.full_name as string) || (p.fullName as string) || handle;
  const biography = (p.biography as string) || (p.bio as string) || "";
  const followers =
    (p.followers as number) ||
    (p.followers_count as number) ||
    (p.followersCount as number) ||
    0;
  const externalUrl =
    (p.external_url as string) ||
    (p.externalUrl as string) ||
    (p.website as string) ||
    "";
  const bioLinks = Array.isArray(p.bio_links)
    ? (p.bio_links as any[])
        .map((b) => (typeof b === "string" ? b : b?.url))
        .filter(Boolean)
    : [];
  const profilePic =
    (p.profile_pic_url_hd as string) ||
    (p.profile_pic_url as string) ||
    (p.profilePicUrl as string) ||
    "";
  const posts =
    (p.posts as any[]) ||
    (p.recent_posts as any[]) ||
    (p.latestPosts as any[]) ||
    [];
  const captions = posts
    .slice(0, 8)
    .map((post) =>
      typeof post?.caption === "string"
        ? post.caption
        : typeof post?.text === "string"
        ? post.text
        : ""
    )
    .filter(Boolean);

  if (!biography && captions.length === 0 && !fullName) {
    throw new Error("ScrapingDog IG returned empty payload");
  }
  return flatten(
    {
      handle: `@${handle}`,
      fullName,
      biography,
      followers,
      external_url: externalUrl,
      bio_links: bioLinks,
      profile_image: profilePic,
      latestPosts: captions
    },
    0
  );
}

/**
 * ScrapingDog X / Twitter profile endpoint.
 */
async function scrapingDogX(handle: string): Promise<string> {
  if (!SCRAPINGDOG_API_KEY) throw new Error("SCRAPINGDOG_API_KEY missing");
  const url = `https://api.scrapingdog.com/twitter/profile?api_key=${encodeURIComponent(
    SCRAPINGDOG_API_KEY
  )}&handle=${encodeURIComponent(handle)}`;
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) {
    throw new Error(
      `ScrapingDog X ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`
    );
  }
  const j = (await res.json()) as Record<string, unknown>;
  const p =
    (j.profile as Record<string, unknown>) ||
    (j.user as Record<string, unknown>) ||
    (j.data as Record<string, unknown>) ||
    j;
  const name = (p.name as string) || (p.fullName as string) || handle;
  const bio = (p.description as string) || (p.bio as string) || "";
  const followers =
    (p.followers_count as number) ||
    (p.followers as number) ||
    0;
  const tweets =
    (j.tweets as any[]) ||
    (p.tweets as any[]) ||
    (p.recent_tweets as any[]) ||
    [];
  const tweetTexts = tweets
    .slice(0, 20)
    .map((t) => (t?.text as string) || (t?.full_text as string) || "")
    .filter(Boolean);

  if (!bio && tweetTexts.length === 0 && !name) {
    throw new Error("ScrapingDog X returned empty payload");
  }
  return flatten(
    {
      handle: `@${handle}`,
      name,
      bio,
      followers,
      recent_tweets: tweetTexts
    },
    0
  );
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

/**
 * Multi-actor X scraper with redundancy. Tries apidojo/tweet-scraper first
 * (most popular, but its output shape drifts between revisions), then
 * apify/twitter-scraper-lite, then quacker/twitter-scraper. Whichever
 * returns usable tweets wins. If all three return empty/garbage, throws.
 */
async function scrapeXProfile(url: string): Promise<string> {
  const handle = handleFromUrl(url);
  if (!handle) throw new Error("Could not parse X handle from URL");

  const actors: Array<{
    slug: string;
    input: Record<string, unknown>;
  }> = [
    {
      slug: "apidojo/tweet-scraper",
      input: { twitterHandles: [handle], maxItems: 25, sort: "Latest" }
    },
    {
      slug: "apify/twitter-scraper-lite",
      input: {
        searchTerms: [`from:${handle}`],
        maxItems: 25,
        sortBy: "Latest"
      }
    },
    {
      slug: "quacker/twitter-scraper",
      input: {
        handles: [handle],
        tweetsDesired: 25,
        addUserInfo: true
      }
    }
  ];

  let items: unknown[] = [];
  let triedActors: string[] = [];
  for (const a of actors) {
    triedActors.push(a.slug);
    try {
      const got = await apifyRun(a.slug, a.input, 50);
      if (got.length > 0) {
        items = got;
        console.log(
          `[scrape:x] actor ${a.slug} returned ${got.length} items for @${handle}`
        );
        break;
      }
      console.warn(`[scrape:x] actor ${a.slug} returned 0 items for @${handle}`);
    } catch (e) {
      console.warn(`[scrape:x] actor ${a.slug} threw:`, e);
    }
  }
  if (items.length === 0) {
    throw new Error(
      `All X actors returned empty for @${handle}. Tried: ${triedActors.join(", ")}.`
    );
  }
  // Field shapes drift between actor revisions: tweets may live under
  // text / fullText / full_text / tweet, author/user under author / user /
  // tweetBy. Read them all defensively and fall back to flattening the
  // raw item if structured extraction whiffs entirely.
  const tweets: string[] = [];
  for (const t of items as Array<Record<string, unknown>>) {
    const txt =
      (t?.text as string) ??
      (t?.fullText as string) ??
      (t?.full_text as string) ??
      (t?.tweet as string) ??
      "";
    if (typeof txt === "string" && txt.trim()) tweets.push(txt.trim());
  }
  const a0 =
    ((items[0] as any)?.author as Record<string, unknown>) ||
    ((items[0] as any)?.user as Record<string, unknown>) ||
    ((items[0] as any)?.tweetBy as Record<string, unknown>) ||
    {};
  const bio =
    (a0.description as string) ||
    (a0.bio as string) ||
    (a0.profile_description as string) ||
    "";
  const name =
    (a0.name as string) ||
    (a0.fullName as string) ||
    (a0.displayName as string) ||
    handle;
  const followers =
    (a0.followersCount as number) ||
    (a0.followers_count as number) ||
    (a0.followers as number) ||
    0;

  // If structured extraction failed, dump the first item's raw flattened
  // shape — better signal for the LLM than an empty scaffold ("Bio: \n
  // Recent posts: •").
  if (tweets.length === 0 && !bio) {
    const raw = flatten(items[0]).slice(0, 2000);
    if (raw.trim().length > 40) return raw;
    throw new Error(
      "Apify returned items with no usable text — handle may be private or scrape was blocked."
    );
  }

  const lines: string[] = [];
  lines.push(`${name} (@${handle}) on X`);
  if (followers) lines.push(`Followers: ${followers.toLocaleString()}`);
  if (bio) lines.push(`Bio: ${bio}`);
  if (tweets.length > 0) {
    lines.push("Recent posts:");
    lines.push("• " + tweets.slice(0, 15).join("\n• "));
  }
  return lines.join("\n\n");
}

/**
 * Multi-actor Instagram scraper with redundancy. Tries apify/instagram-scraper
 * first (free tier, directUrls input), falls back to apify/instagram-api-scraper
 * (faster, returns profile JSON), then dtrungtin/instagram-profile-scraper
 * (community alternative). Whichever returns usable profile data wins.
 */
async function scrapeInstagramProfile(url: string): Promise<string> {
  const handle = handleFromUrl(url);
  if (!handle) throw new Error("Could not parse Instagram handle from URL");

  const actors: Array<{
    slug: string;
    input: Record<string, unknown>;
  }> = [
    // Variant 1: details mode — should return profile + recent posts in
    // one shot. Free-tier-compatible. When it works this is everything
    // we need in a single call.
    {
      slug: "apify/instagram-scraper",
      input: {
        directUrls: [url],
        resultsType: "details",
        resultsLimit: 10,
        addParentData: false
      }
    },
    // Variant 2: posts mode — explicitly request post objects with
    // captions. Use this if the details mode came back light on posts.
    {
      slug: "apify/instagram-scraper",
      input: {
        directUrls: [url],
        resultsType: "posts",
        resultsLimit: 12,
        addParentData: false
      }
    },
    {
      slug: "apify/instagram-api-scraper",
      input: { usernames: [handle] }
    },
    {
      slug: "dtrungtin/instagram-profile-scraper",
      input: { usernames: [handle] }
    }
  ];

  let items: unknown[] = [];
  let triedActors: string[] = [];
  for (const a of actors) {
    triedActors.push(a.slug);
    try {
      const got = await apifyRun(a.slug, a.input, 60);
      if (got.length > 0) {
        items = got;
        console.log(
          `[scrape:ig] actor ${a.slug} returned ${got.length} items for @${handle}`
        );
        break;
      }
      console.warn(`[scrape:ig] actor ${a.slug} returned 0 items for @${handle}`);
    } catch (e) {
      console.warn(`[scrape:ig] actor ${a.slug} threw:`, e);
    }
  }
  if (items.length === 0) {
    throw new Error(
      `All Instagram actors returned empty for @${handle}. Tried: ${triedActors.join(", ")}.`
    );
  }

  // Heuristically locate the profile row (has biography or fullName) and
  // any post rows (have caption or shortCode). Some actor revisions return
  // a single profile object with latestPosts inline — handle both.
  let profile: Record<string, unknown> | null = null;
  const posts: Array<Record<string, unknown>> = [];
  for (const it of items as Array<Record<string, unknown>>) {
    if (it && (it.biography !== undefined || it.fullName !== undefined)) {
      profile = it;
      if (Array.isArray(it.latestPosts)) {
        for (const lp of it.latestPosts as Array<Record<string, unknown>>) {
          posts.push(lp);
        }
      }
    } else if (it && (it.caption !== undefined || it.shortCode !== undefined)) {
      posts.push(it);
    }
  }
  if (!profile) {
    profile = items[0] as Record<string, unknown>;
  }
  const captions = posts
    .map((p) => (typeof p.caption === "string" ? p.caption : ""))
    .filter(Boolean)
    .slice(0, 8);

  // Enrich extraction: pull profile image, bio links, and external URL.
  // For an IG profile the image + bio + first few captions + any links in
  // the bio give the LLM enough specific signal to write a real opener.
  const profilePic =
    (profile.profile_pic_url_hd as string) ||
    (profile.profilePicUrl as string) ||
    (profile.profile_pic_url as string) ||
    "";
  const bioLinks = Array.isArray((profile as any).biographyExternalUrls)
    ? ((profile as any).biographyExternalUrls as any[])
        .map((b) =>
          typeof b === "string" ? b : b?.url || b?.external_url || ""
        )
        .filter(Boolean)
    : Array.isArray((profile as any).bio_links)
    ? ((profile as any).bio_links as any[])
        .map((b) =>
          typeof b === "string" ? b : b?.url || b?.external_url || ""
        )
        .filter(Boolean)
    : [];

  // SUBSTANCE CHECK — if we got a profile row back but it has NO bio,
  // NO real name, AND no captions, the scrape is functionally empty
  // and we should throw so the caller can fall through to a different
  // vendor (ScrapingDog). Before this check, scrapeInstagramProfile
  // would return a thin "handle: @ethos" string that passed the chain's
  // success path — opener ended up just mentioning the username.
  const hasRealName =
    typeof profile.fullName === "string" &&
    (profile.fullName as string).trim().length > 1;
  const hasBio =
    typeof profile.biography === "string" &&
    (profile.biography as string).trim().length > 5;
  const hasCaptions = captions.length > 0;
  if (!hasRealName && !hasBio && !hasCaptions) {
    throw new Error(
      `Apify IG returned only metadata for @${handle} (no bio, no captions). Falling through to next vendor.`
    );
  }

  return flatten(
    {
      handle: `@${handle}`,
      fullName: profile.fullName,
      biography: profile.biography,
      external_url: profile.externalUrl ?? (profile as any).external_url,
      bio_links: bioLinks,
      profile_image: profilePic,
      followers: profile.followersCount,
      posts: profile.postsCount,
      latestPosts: captions
    },
    0
  );
}

/**
 * scrapePublicProfile — the chain.
 *
 * CRITICAL FIX (May 2026): for X / Instagram / Facebook URLs we now SKIP
 * Exa entirely and go straight to Apify. The previous chain called Exa
 * first, and Exa just returned the page <title> for those auth-walled
 * platforms (e.g. "Jack Jay (@jackjay.io) · Instagram photos and videos",
 * ~100 chars) which passed our `length > 80` gate, so Apify never ran
 * and the LLM got only the title to work with — producing the substance-
 * less openers Jack reported.
 *
 * The new order:
 *   - Social URL → Apify multi-actor chain only. If all actors fail,
 *     throw (don't silently return the Exa title).
 *   - Non-social URL (LinkedIn public posts, blogs, Substack, Crunchbase) →
 *     Exa first (it works there), Apify fallback isn't applicable.
 */
export async function scrapePublicProfile(url: string): Promise<string> {
  // SOCIAL URLs — auth-walled, Exa can't reach past the page title.
  //
  // True cross-provider redundancy: try Apify first (we have a token,
  // multiple actors), then ScrapingDog (different vendor entirely with
  // dedicated IG + X endpoints). Whichever returns substance wins. Each
  // vendor is independently configurable via env var — if a key is
  // missing, that vendor is silently skipped.
  if (isXUrl(url)) {
    const handle = handleFromUrl(url) || "";
    const errors: string[] = [];
    if (APIFY_TOKEN) {
      try {
        return await scrapeXProfile(url);
      } catch (e: any) {
        errors.push(`apify: ${e?.message ?? e}`);
      }
    }
    if (SCRAPINGDOG_API_KEY && handle) {
      try {
        return await scrapingDogX(handle);
      } catch (e: any) {
        errors.push(`scrapingdog: ${e?.message ?? e}`);
      }
    }
    throw new Error(
      `Couldn't scrape @${handle} on X from any vendor. ${errors.join(" | ")}`
    );
  }
  if (isInstagramUrl(url)) {
    const handle = handleFromUrl(url) || "";
    const errors: string[] = [];
    if (APIFY_TOKEN) {
      try {
        return await scrapeInstagramProfile(url);
      } catch (e: any) {
        errors.push(`apify: ${e?.message ?? e}`);
      }
    }
    if (SCRAPINGDOG_API_KEY && handle) {
      try {
        return await scrapingDogInstagram(handle);
      } catch (e: any) {
        errors.push(`scrapingdog: ${e?.message ?? e}`);
      }
    }
    if (!APIFY_TOKEN && !SCRAPINGDOG_API_KEY) {
      throw new Error(
        "Instagram profiles can't be scraped without APIFY_TOKEN or SCRAPINGDOG_API_KEY — set one in env or paste a few sentences manually."
      );
    }
    throw new Error(
      `Couldn't scrape @${handle} on Instagram from any vendor. ${errors.join(" | ")}`
    );
  }

  // NON-SOCIAL URLs — Exa handles these well (LinkedIn, blogs, etc.).
  let exaText = "";
  try {
    exaText = await exaGetContents(url);
  } catch {
    /* fall through */
  }
  if (exaText && exaText.trim().length > 80) {
    return exaText;
  }
  if (exaText && exaText.trim().length > 0) {
    return exaText;
  }

  throw new Error(
    "Couldn't fetch that URL. Paste a few sentences manually instead."
  );
}
