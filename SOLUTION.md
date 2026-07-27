# Reimagine SyncdIn — Solution Write-up

## The problem I picked

SyncdIn's core value is the twin-to-twin negotiation loop, and the platform already
has real proof this works: the launch article shows real usage numbers, and the
codebase has a mature invite system (`/[slug]` + `pending_invites`) where a guest
can watch a simulated conversation before signing up. There's also a second working
example of the same "let a stranger taste it first" pattern on community/conference
pages (`preview-match` + `QuickJoinForm`) — a guest pastes who they are and gets an
instant, concrete match against room members, no signup required.

But the one page most likely to actually get shared outside the app — the personal
public profile at `/u/[handle]` — has none of this. Every guest interaction on a
profile page redirects straight to `/login`. There's no proof, no "wow" moment,
nothing that shows a visitor the product actually works before asking them to sign
up. Given the brief explicitly asks for the fix most likely to help the platform
"attract users," this felt like the sharpest, most defensible gap: not inventing a
new idea, but noticing SyncdIn had already validated a growth mechanic and simply
hadn't shipped it to its highest-traffic organic page.

## What I built

A **Guest Preview Match** on `/u/[handle]`. A logged-out visitor sees a small form
instead of a login wall: two short fields ("about you" / "what you're looking
for"). On submit, the profile owner's twin context (`goals`, `deal_preferences`)
is combined with the guest's input and sent to an LLM, which returns one concrete,
specific sentence describing a win-win between the two people, plus a first step.
The visitor sees this instantly, with no account. Then a CTA: "Want the full
thing? Sign up."

Implementation:
- `lib/gemini.ts` — a small, isolated AI client (kept fully separate from
  `lib/anthropic.ts`, which powers the rest of the app)
- `app/api/profile-preview-match/route.ts` — validates input, checks a per-IP
  rate limit (3 previews/hour) **before** any AI call, looks up the profile and
  twin context, builds the prompt, calls the model, returns the result
- `public.guest_preview_limits` — a new, minimal table (IP + timestamp) backing
  the rate limit
- `app/u/[handle]/ProfilePreviewForm.tsx` — the client-side form, loading/result/
  rate-limited states, and the signup CTA
- One integration point in the existing `app/u/[handle]/page.tsx`, swapping the
  guest-facing login button for the new form (owner-facing behavior untouched)

## Trade-offs and honest notes

- **Model provider**: this route runs on Gemini rather than Anthropic, purely
  because of my own API credit constraints while building. The architecture
  keeps this fully swappable — `lib/gemini.ts` mirrors the shape of
  `lib/anthropic.ts`, so pointing this route at Claude instead is a small,
  contained change, not a rewrite.
- **Scope discipline**: I deliberately built one feature well rather than several
  partially. I considered (and scoped, then set aside) two other real gaps I found
  in the codebase: proactive/automatic matching across the network (still
  genuinely unbuilt — every existing match feature requires the user to search,
  pick a target, or paste context first), and a "share your profile" one-click
  copy-link button (currently buried inside a gated Personal Intelligence card
  instead of on the main dashboard). Both are good candidates for a v2.
- **A gap I found and fixed, not just noticed**: the two existing sibling
  endpoints this feature is modeled on (`/api/demo-conversation` and
  `/api/communities/[slug]/preview-match`) are both unauthenticated, both call
  an LLM directly, and **neither has any rate limiting** — a real, live cost/abuse
  exposure in the shipped product. I made sure the new route doesn't repeat that
  gap.
- **Data handling**: guest interactions are not persisted anywhere except the
  rate-limit log (IP + timestamp only, no message content stored) — this is a
  one-shot preview, not a real conversation thread, and shouldn't be treated or
  logged like one.

## Secondary improvement: one-click "share profile" button

While testing the main feature, I noticed there was no quick way to share your own
profile — the only path was manually copying the URL from the browser bar. I added
a small `ShareButton` component (copy-to-clipboard, with a "Copied!" confirmation
state) in two places: the global `TopBar` profile dropdown (available from every
authenticated page) and directly on the owner's own `/u/[handle]` page next to the
"dashboard →" link (visible right when you're looking at the page you'd want to
share). Both reuse the app's existing `retro-btn` styling and the same
`navigator.clipboard` pattern already used elsewhere in the codebase — no new
dependencies, no new styling.

This is small on its own, but it's directly upstream of the main feature: the
guest preview match only creates value once a profile link actually gets shared
and clicked. Making sharing effortless is a natural, cheap complement to fixing
what happens after someone clicks.

## Why this, over the more ambitious "automatic matching" option

I scoped both. Automatic/proactive matching across the whole network is the
platform's real long-term promise (their own roadmap and manifesto page both
describe it explicitly, and it's genuinely still unbuilt). But it requires new
scoring infrastructure, a background job, and new dashboard surfaces — a much
larger blast radius under a tight timeline. The guest preview match is smaller,
finishable to a high standard, and still a direct, demonstrable answer to the
brief: it turns the platform's highest-leverage organic page from a dead end into
a working proof of the product's core value.