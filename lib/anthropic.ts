import Anthropic from "@anthropic-ai/sdk";

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!
});

// Twin generation model. Override with the TWIN_MODEL env var if the default
// string is ever wrong — no code change / redeploy needed, just set the env var.
// Swap to a fine-tuned snapshot once you have ~10k edit deltas.
export const TWIN_MODEL = process.env.TWIN_MODEL || "claude-sonnet-4-6";
