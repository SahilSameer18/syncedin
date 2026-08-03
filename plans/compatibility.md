Twin Compatibility Matrix (with fixes)
The feature, one sentence

Upgrade the existing guest preview form into a scored "compatibility match" — score, green flag, private red flag, and a win-win — with a premium, animated reveal, shareable as a card.

Fix 1 — Red flag privacy handling

Rule: The red flag is shown to the guest only, never included in anything shareable or public.

The share card includes: score + green flag + win-win only
The on-screen result (before sharing) can show all four, since only the guest sees it live
The AI prompt should be instructed to keep the red flag about working style/pace fit, not personal criticism — e.g., "may prefer faster decision cycles" instead of anything that reads as a personal judgment
Fix 2 — Login-gating logic (carried over from before)
Guest version uses the profile owner's real data, but the guest's own input stays generic/one-shot — no saved profile, no persistent matching
After the reveal: CTA says "This was a one-time match. Sign up to build your real twin and get matched with everyone on SyncdIn, not just one person."
Rate limiting stays exactly as before (3/hour per IP) — this is unchanged and still needed, since it's still an AI call
Technical Plan
1. Modify app/api/profile-preview-match/route.ts

Change the prompt to explicitly request structured JSON:

Return ONLY valid JSON in this exact shape, no other text:
{
  "score": <number 0-100>,
  "green_flag": "<one sentence — why this could work well>",
  "red_flag": "<one sentence — a possible friction point, about working style/pace only, never personal criticism>",
  "win_win": "<one sentence — concrete next step>"
}

Add JSON parsing with a fallback:

ts
let parsed;
try {
  parsed = JSON.parse(response.text);
} catch {
  // Fallback if the model didn't return clean JSON
  return NextResponse.json({
    score: null,
    green_flag: response.text.slice(0, 200),
    red_flag: null,
    win_win: "Reach out to continue the conversation."
  });
}

Validate the parsed shape before returning (check score is a number 0-100, all fields are strings) — if invalid, use the same fallback path above rather than sending broken data to the frontend.

2. Modify app/u/[handle]/ProfilePreviewForm.tsx

New states to add:

analyzing — shows the rotating text sequence ("Scanning profile goals...", "Cross-referencing deal preferences...", "Calculating compatibility...") for a couple seconds before the real result appears, even if the API responds faster — small deliberate delay for the "wow" effect
result — now holds the full structured object, not just one string

New UI for the reveal:

Score counts up from 0 to the real number using a simple useEffect + setInterval loop (increment a displayed number every ~20ms until it hits the real score)
Score shown with a progress-bar style visual, plus the number
Green flag and win-win shown clearly, styled positively (their existing accent color)
Red flag shown separately, visually softer/smaller — clearly framed as "something to be aware of," not alarming
Share button generates a card containing only score + green flag + win-win (never the red flag) — reuse the same --panel-2 styling approach from before for visual consistency

Input change:

Replace the two separate boxes with one larger textarea: placeholder "Pitch my AI Twin on who you are..."
3. What stays exactly the same, unchanged
Rate limiting logic (3/hour per IP) — no changes needed
guest_preview_limits table — no changes needed
The "still building their twin" fallback path — no changes needed
Build order
Update the API route's prompt + add JSON parsing/validation with fallback — test with curl or Postman first, before touching the UI, so you know the backend works in isolation
Build the "analyzing" animated sequence
Build the score count-up + visual bars
Build the green/red flag + win-win display
Build the share card (score + green flag + win-win only)
Test the full flow end to end, including a case where the AI returns bad JSON, to confirm the fallback actually works