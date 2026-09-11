"use client";

import { useCallback, useState } from "react";
import { useAiProviderConfig } from "@/features/settings/useAiProviderConfig";
import type { PlayerProfileData } from "./types";

export type AnalyzeStatus = "idle" | "loading" | "error";

/** Drives the Analyze/Refresh flow on top of whatever the server already
 * rendered (`initial`, from features/playermodel/data.ts). The AI key
 * used to phrase each focus area's coaching text is the same BYO one
 * Settings already holds for the board's coach - never stored, sent only
 * on this one request, same pattern as useMoveCommentary's /api/coach
 * calls. */
export function usePlayerProfile(initial: PlayerProfileData | null) {
  const [profile, setProfile] = useState<PlayerProfileData | null>(initial);
  const [status, setStatus] = useState<AnalyzeStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const { config } = useAiProviderConfig();

  const analyze = useCallback(
    async (opts?: { force?: boolean }) => {
      setStatus("loading");
      setError(null);
      try {
        const res = await fetch("/api/player-profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            force: opts?.force,
            provider: config.provider,
            apiKey: config.apiKey,
            model: config.model,
          }),
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `Request failed: ${res.status}`);
        }
        const data = (await res.json()) as PlayerProfileData;
        setProfile(data);
        setStatus("idle");
      } catch (e) {
        setError((e as Error).message || "Analysis failed.");
        setStatus("error");
      }
    },
    [config],
  );

  return { profile, status, error, analyze };
}
