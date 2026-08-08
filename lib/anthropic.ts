import { getGeminiClients, GEMINI_MODEL } from "./gemini";

// Twin generation model. Defaulted to Gemini 3.6 Flash with fallback.
export const TWIN_MODEL = GEMINI_MODEL;

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

function isRateLimited(e: any): boolean {
  const msg = (e?.message || e?.error?.message || String(e)).toLowerCase();
  const status = e?.status ?? 0;
  return (
    status === 429 ||
    status === 529 ||
    msg.includes("quota") ||
    msg.includes("resource_exhausted") ||
    msg.includes("rate_limit") ||
    msg.includes("too_many_requests")
  );
}

function isTransient(e: any): boolean {
  const s = e?.status ?? 0;
  return isRateLimited(e) || s === 500 || s === 502 || s === 503 || s === 504;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const FALLBACK_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-2.0-flash",
  "gemini-3.5-flash",
  "gemini-3.1-flash-lite",
  "gemini-3.6-flash",
  "gemini-2.0-flash-lite"
];

/**
 * Universal Gemini-backed adapter that fulfills the Anthropic SDK surface area
 * (`anthropic.messages.create(...)`), featuring multi-key rotation and multi-model fallback.
 */
export const anthropic = {
  messages: {
    create: async (params: {
      model?: string;
      max_tokens?: number;
      system?: string | any[];
      messages: Array<{ role: string; content: string | any[] }>;
      temperature?: number;
      tools?: any[];
    }) => {
      // Extract system instruction
      let systemInstruction: string | undefined = undefined;
      if (params.system) {
        if (typeof params.system === "string") {
          systemInstruction = params.system;
        } else if (Array.isArray(params.system)) {
          systemInstruction = params.system
            .map((s) => (typeof s === "string" ? s : s.text || JSON.stringify(s)))
            .join("\n\n");
        }
      }

      // Convert messages to Gemini format
      const contents = params.messages.map((m) => {
        let text = "";
        if (typeof m.content === "string") {
          text = m.content;
        } else if (Array.isArray(m.content)) {
          text = m.content
            .map((c) => (typeof c === "string" ? c : c.text || JSON.stringify(c)))
            .join("\n");
        }
        return {
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text }]
        };
      });

      const config: any = {};
      if (systemInstruction) config.systemInstruction = systemInstruction;
      if (params.max_tokens) config.maxOutputTokens = params.max_tokens;
      if (typeof params.temperature === "number") config.temperature = params.temperature;

      // Model resolution with automatic fallback across Gemini Flash models
      const requestedModel =
        params.model && !params.model.includes("claude")
          ? params.model
          : GEMINI_MODEL;

      const modelsToTry = Array.from(new Set([requestedModel, ...FALLBACK_MODELS]));
      const clients = getGeminiClients();
      let lastErr: any = null;

      // 2D Rotation matrix: Try each model across ALL available API Keys before falling back to next model
      for (const modelName of modelsToTry) {
        for (let keyIdx = 0; keyIdx < clients.length; keyIdx++) {
          const client = clients[keyIdx];
          try {
            const res = await client.models.generateContent({
              model: modelName,
              contents,
              config
            });

            const text = res.text ?? "";

            return {
              id: `msg_gemini_${Date.now()}`,
              type: "message",
              role: "assistant",
              model: modelName,
              content: [
                {
                  type: "text",
                  text
                }
              ],
              stop_reason: "end_turn",
              usage: {
                input_tokens: 0,
                output_tokens: 0
              }
            };
          } catch (err: any) {
            lastErr = err;
            if (isRateLimited(err)) {
              console.warn(
                `[gemini-fallback] Key #${keyIdx + 1} on ${modelName} rate-limited/quota-exceeded. Trying next key/model...`
              );
              continue;
            }
            throw err;
          }
        }
      }

      throw lastErr;
    },
    stream: (params: {
      model?: string;
      max_tokens?: number;
      system?: string | any[];
      messages: Array<{ role: string; content: string | any[] }>;
      temperature?: number;
      tools?: any[];
    }) => {
      const listeners: { [key: string]: Function[] } = {};
      let finalPromise: Promise<any> | null = null;

      const runStream = () => {
        if (!finalPromise) {
          finalPromise = anthropic.messages.create(params).then((res) => {
            const text = res.content[0]?.text ?? "";
            if (listeners["text"]) {
              listeners["text"].forEach((fn) => fn(text));
            }
            return res;
          });
        }
        return finalPromise;
      };

      const streamObj = {
        on: (event: string, fn: Function) => {
          if (!listeners[event]) listeners[event] = [];
          listeners[event].push(fn);
          return streamObj;
        },
        finalMessage: async () => {
          return runStream();
        }
      };

      setTimeout(() => {
        runStream().catch((err) => {
          if (listeners["error"]) {
            listeners["error"].forEach((fn) => fn(err));
          }
        });
      }, 0);

      return streamObj;
    }
  }
};

/**
 * Wraps AI calls with exponential-backoff retry on transient failures.
 */
export async function withAnthropicRetry<T>(
  fn: () => Promise<T>,
  opts: { retries?: number; label?: string } = {}
): Promise<T> {
  const retries = opts.retries ?? 3;
  let backoff = 2000; // 2s initial backoff for Gemini free-tier rate limits
  let lastErr: any = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (e: any) {
      lastErr = e;
      const rateLimited = isRateLimited(e);
      const retryable = isTransient(e);

      if (!retryable || attempt === retries) {
        const friendly = rateLimited
          ? "All Gemini free tier keys/models are temporarily busy. Please wait ~10 seconds and try again."
          : e?.message || "AI service temporarily unavailable. Please try again.";
        throw new FriendlyAnthropicError(
          friendly,
          e?.status ?? 429,
          retryable
        );
      }

      console.warn(
        `[gemini-retry${opts.label ? ":" + opts.label : ""}] attempt ${
          attempt + 1
        }/${retries + 1} rate-limited/transient. Backing off ${backoff}ms...`
      );
      await sleep(backoff);
      backoff *= 2;
    }
  }

  throw new FriendlyAnthropicError(
    "Gemini free tier quota temporarily busy. Please retry in a few seconds.",
    429,
    true
  );
}
