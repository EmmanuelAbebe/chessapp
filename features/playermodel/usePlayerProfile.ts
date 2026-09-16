"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAiProviderConfig } from "@/features/settings/useAiProviderConfig";
import type { PlayerProfileData } from "./types";

export type AnalyzeStatus = "idle" | "loading" | "error";

export type AnalyzeOptions = {
  force?: boolean;
  maxGames?: number;
  /** Lichess perf type - "blitz" | "bullet" | "rapid" | "classical".
   * Defaults server-side to "blitz" when omitted. Only blitz has its own
   * reference population/skill+style models today, so requesting another
   * speed still runs real per-game analysis (accuracy, complexity, etc.)
   * but the skill-estimate/style/cohort comparisons are made against
   * blitz players - see the caveat the server adds when this isn't
   * "blitz". */
  timeClass?: string;
  /** Which connected account to pull games from - "lichess" (default) or
   * "chesscom". The reference population/skill+style/cohort machinery is
   * built entirely from Lichess data, so a chesscom analysis only ever
   * returns per-game charts (accuracy, complexity, win rate, openings) -
   * see the caveat the server adds for a non-lichess source. */
  source?: "lichess" | "chesscom";
};

const POLL_INTERVAL_MS = 1500;

/** Drives the Analyze/Refresh flow on top of whatever the server already
 * rendered (`initial`, from features/playermodel/data.ts). Goes through
 * the chunked /api/player-profile/jobs endpoint rather than the
 * single-shot one, so a large request can show real progress
 * (`progress`) and update `profile` with each real partial snapshot as
 * it arrives - every chart reading from `profile` updates live as more
 * of the request completes, not just at the very end.
 *
 * The AI key used to phrase each focus area's coaching text is the same
 * BYO one Settings already holds for the board's coach - never stored,
 * sent only on this one request, same pattern as useMoveCommentary's
 * /api/coach calls. */
export function usePlayerProfile(initial: PlayerProfileData | null) {
  const [profile, setProfile] = useState<PlayerProfileData | null>(initial);
  const [status, setStatus] = useState<AnalyzeStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ processed: number; total: number } | null>(null);
  const { config } = useAiProviderConfig();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current !== null) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => stopPolling, [stopPolling]);

  const analyze = useCallback(
    async (opts?: AnalyzeOptions) => {
      stopPolling();
      setStatus("loading");
      setError(null);
      setProgress(null);
      try {
        const startRes = await fetch("/api/player-profile/jobs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            force: opts?.force,
            maxGames: opts?.maxGames,
            timeClass: opts?.timeClass,
            source: opts?.source,
            provider: config.provider,
            apiKey: config.apiKey,
            model: config.model,
          }),
        });
        if (!startRes.ok) {
          const text = await startRes.text();
          throw new Error(text || `Request failed: ${startRes.status}`);
        }
        const started = (await startRes.json()) as
          | { done: true; profile: PlayerProfileData }
          | { done: false; jobId: string };

        if (started.done) {
          setProfile(started.profile);
          setStatus("idle");
          return;
        }

        await new Promise<void>((resolve) => {
          pollRef.current = setInterval(async () => {
            try {
              const res = await fetch(`/api/player-profile/jobs/${started.jobId}`);
              if (!res.ok) {
                const text = await res.text();
                throw new Error(text || `Request failed: ${res.status}`);
              }
              const s = (await res.json()) as {
                status: "running" | "done" | "error";
                games_processed: number;
                games_total: number;
                profile: PlayerProfileData | null;
                error: string | null;
              };
              setProgress({ processed: s.games_processed, total: s.games_total });
              if (s.profile) setProfile(s.profile);

              if (s.status === "done") {
                stopPolling();
                setStatus("idle");
                setProgress(null);
                resolve();
              } else if (s.status === "error") {
                stopPolling();
                setError(s.error || "Analysis failed.");
                setStatus("error");
                setProgress(null);
                resolve();
              }
            } catch (e) {
              stopPolling();
              setError((e as Error).message || "Analysis failed.");
              setStatus("error");
              setProgress(null);
              resolve();
            }
          }, POLL_INTERVAL_MS);
        });
      } catch (e) {
        setError((e as Error).message || "Analysis failed.");
        setStatus("error");
        setProgress(null);
      }
    },
    [config, stopPolling],
  );

  return { profile, status, error, progress, analyze };
}
