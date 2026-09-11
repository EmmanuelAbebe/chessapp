import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import {
  DEFAULT_MODEL_BY_PROVIDER,
  type AiProvider,
} from "@/features/settings/ai-provider-types";

/** Builds the actual model client for whichever provider the request
 * asked for, using the caller's own key - `null` if there's no usable
 * key at all (no user key, and, for anything but "google", no env var
 * to fall back to either). Never logs the key; it only ever passes
 * through this function on its way to the provider's own SDK client.
 * Shared by /api/coach and /api/player-profile - every server-side
 * caller of a user's BYO AI key goes through this one place. */
export function resolveModel(
  provider: AiProvider,
  apiKey: string,
  model: string,
): LanguageModel | null {
  const modelId = model || DEFAULT_MODEL_BY_PROVIDER[provider];
  const key = apiKey || undefined;

  switch (provider) {
    case "google": {
      // The only provider with a server-side fallback - createGoogleGenerativeAI
      // reads GOOGLE_GENERATIVE_AI_API_KEY itself when apiKey is undefined.
      if (!key && !process.env.GOOGLE_GENERATIVE_AI_API_KEY) return null;
      return createGoogleGenerativeAI({ apiKey: key })(modelId);
    }
    case "openai":
      return key ? createOpenAI({ apiKey: key })(modelId) : null;
    case "anthropic":
      return key ? createAnthropic({ apiKey: key })(modelId) : null;
    case "groq":
      return key ? createGroq({ apiKey: key })(modelId) : null;
    default:
      return null;
  }
}
