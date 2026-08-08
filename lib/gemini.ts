import { GoogleGenAI } from "@google/genai";

/**
 * Gathers all configured Gemini API keys from environment variables.
 * Supports:
 *  - GEMINI_API_KEY (or GOOGLE_API_KEY)
 *  - GEMINI_API_KEY_2
 *  - GEMINI_API_KEY_3
 *  - Or comma-separated GEMINI_API_KEYS="key1,key2,key3"
 */
export function getGeminiApiKeys(): string[] {
  const keys: string[] = [];
  
  if (process.env.GEMINI_API_KEYS) {
    keys.push(
      ...process.env.GEMINI_API_KEYS.split(",")
        .map((k) => k.trim())
        .filter(Boolean)
    );
  }
  if (process.env.GEMINI_API_KEY) keys.push(process.env.GEMINI_API_KEY.trim());
  if (process.env.GOOGLE_API_KEY) keys.push(process.env.GOOGLE_API_KEY.trim());
  if (process.env.GEMINI_API_KEY_2) keys.push(process.env.GEMINI_API_KEY_2.trim());
  if (process.env.GEMINI_API_KEY_3) keys.push(process.env.GEMINI_API_KEY_3.trim());

  const unique = Array.from(new Set(keys)).filter(Boolean);
  return unique.length > 0 ? unique : [""];
}

/**
 * Creates GoogleGenAI instances for every configured key.
 */
export function getGeminiClients(): GoogleGenAI[] {
  const keys = getGeminiApiKeys();
  return keys.map((apiKey) => new GoogleGenAI({ apiKey }));
}

// Default client for single-use operations
export const gemini = new GoogleGenAI({
  apiKey: getGeminiApiKeys()[0] || ""
});

export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
