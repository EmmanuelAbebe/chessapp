// No "use client" here on purpose - this plain data is imported by both
// the client-side settings hook (useAiProviderConfig.ts) and the server
// route (app/api/coach/route.ts); a "use client" module boundary would
// make importing it from server code fragile.

export type AiProvider = "google" | "openai" | "anthropic" | "groq";

export const DEFAULT_MODEL_BY_PROVIDER: Record<AiProvider, string> = {
  google: "gemini-3.5-flash-lite",
  openai: "gpt-4.1-mini",
  anthropic: "claude-haiku-4-5",
  groq: "llama-3.3-70b-versatile",
};
