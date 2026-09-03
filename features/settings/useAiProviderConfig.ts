"use client";

import { useEffect, useState } from "react";
import { DEFAULT_MODEL_BY_PROVIDER, type AiProvider } from "./ai-provider-types";

export type { AiProvider };
export { DEFAULT_MODEL_BY_PROVIDER };

export type AiProviderConfig = {
  provider: AiProvider;
  apiKey: string;
  model: string;
};

const DEFAULT_CONFIG: AiProviderConfig = {
  provider: "google",
  apiKey: "",
  model: DEFAULT_MODEL_BY_PROVIDER.google,
};

// A separate localStorage key from AppSettings (features/settings/
// SettingsContext.tsx) on purpose - that store is plain in-memory state
// today (no persistence at all, fine for UI toggles that just reset on
// reload) and holds nothing sensitive. An API key someone typed in once
// needs to actually survive a reload, and deserves to live somewhere
// distinct from a generic settings blob that might grow to include
// things meant to sync to a future account backend.
const STORAGE_KEY = "chessapp:ai-provider-config";

function readStoredConfig(): AiProviderConfig {
  if (typeof window === "undefined") return DEFAULT_CONFIG;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw);
    return {
      provider: parsed.provider ?? DEFAULT_CONFIG.provider,
      apiKey: parsed.apiKey ?? DEFAULT_CONFIG.apiKey,
      model: parsed.model ?? DEFAULT_CONFIG.model,
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

/** Where the human picks which AI provider/key/model powers the coach -
 * an empty `apiKey` means "no override," letting /api/coach fall back to
 * its own env var (only meaningful for the default "google" provider,
 * the only one with a server-side key to fall back to). Persisted to
 * localStorage so it survives a reload; read once on mount rather than
 * on every render since it's a synchronous browser API read. */
export function useAiProviderConfig() {
  // Starts at the default on the server/first client render (avoids a
  // hydration mismatch) and hydrates from storage right after mount.
  const [config, setConfigState] = useState<AiProviderConfig>(DEFAULT_CONFIG);

  useEffect(() => {
    setConfigState(readStoredConfig());
  }, []);

  function setConfig(next: AiProviderConfig) {
    setConfigState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Storage can fail (private browsing, quota) - the in-memory
      // state above still updates for this session either way.
    }
  }

  return { config, setConfig };
}
