import Anthropic from "@anthropic-ai/sdk";

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!
});

// Twin generation model. Override with the TWIN_MODEL env var if the default
// string is ever wrong — no code change / redeploy needed, just set the env var.
// Swap to a fine-tuned snapshot once you have ~10k edit deltas.
export const TWIN_MODEL = process.env.TWIN_MODEL || "claude-sonnet-4-6";

// Friendly, human-readable error a UI can show without leaking internals.
// "Overloaded" (HTTP 529) and "rate_limit" (HTTP 429) are the two we hit
// most in practice — both transient, both worth retrying.
export class FriendlyAnthropicError extends Error {
  public readonly status: number;
  public readonly retryable: boolean;
  constructor(message: string, status: number, retryable: boolean) {
    super(message);
    this.name = "FriendlyAnthropicError";
    this.status = status;
    this.retryable = retryable;
  }
}

type AnthropicLike = {
  status?: number;
  error?: { type?: string; message?: string };
  message?: string;
};

function isOverloaded(e: AnthropicLike): boolean {
  return (
    e.status === 529 ||
    e.error?.type === "overloaded_error" ||
    /overloaded/i.test(e.message ?? "") ||
    /overloaded/i.test(e.error?.message ?? "")
  );
}

function isRateLimited(e: AnthropicLike): boolean {
  return (
    e.status === 429 ||
    e.error?.type === "rate_limit_error" ||
    /rate.?limit/i.test(e.message ?? "")
  );
}

function isTransient(e: AnthropicLike): boolean {
  const s = e.status ?? 0;
  return isOverloaded(e) || isRateLimited(e) || s === 500 || s === 502 || s === 503 || s === 504;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Wraps any Anthropic SDK call with exponential-backoff retry on transient
 * failures (529 overloaded, 429 rate-limited, 5xx). Throws a
 * FriendlyAnthropicError with a user-presentable message after the final
 * retry fails — callers can pass `err.message` straight to the UI.
 *
 * Usage:
 *   const res = await withAnthropicRetry(() =>
 *     anthropic.messages.create({ model: TWIN_MODEL, ... })
 *   );
 */
export async function withAnthropicRetry<T>(
  fn: () => Promise<T>,
  opts: { retries?: number; label?: string } = {}
): Promise<T> {
  const retries = opts.retries ?? 4;
  // Initial backoff: 800ms, then 1.6s, 3.2s, 6.4s — ~12s total worst case.
  // Overloaded events typically clear in 2-10 seconds.
  let backoff = 800;
  let lastErr: AnthropicLike = {};
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (e: any) {
      lastErr = e;
      const overloaded = isOverloaded(e);
      const retryable = isTransient(e);
      if (!retryable || attempt === retries) {
        const friendly = overloaded
          ? "Claude is overloaded right now — give it a few seconds and try again. We'll auto-retry next time."
          : isRateLimited(e)
            ? "Hit the AI rate limit. Wait ~30 seconds and try again."
            : e?.message || "AI call failed. Retrying...";
        throw new FriendlyAnthropicError(
          friendly,
          e?.status ?? 0,
          retryable
        );
      }
      console.warn(
        `[anthropic-retry${opts.label ? ":" + opts.label : ""}] attempt ${
          attempt + 1
        }/${retries + 1} failed (status ${e?.status}), backing off ${backoff}ms`
      );
      // Jitter so concurrent overloaded requests don't all retry in lock-step.
      const jitter = Math.random() * 200;
      await sleep(backoff + jitter);
      backoff *= 2;
    }
  }
  // Unreachable, but TS demands a return.
  throw new FriendlyAnthropicError(
    "AI call exhausted retries",
    (lastErr as any)?.status ?? 0,
    true
  );
}
