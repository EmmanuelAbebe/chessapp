"use client";

import { useEffect, useState } from "react";
import type { GameHistoryEntry } from "./types";

// Same separate-key-per-concern convention as
// features/settings/useAiProviderConfig.ts - game history is its own
// thing, not folded into the generic (unpersisted) AppSettings blob.
const STORAGE_KEY = "chessapp:game-history";

// Bounds localStorage growth - a personality profile only needs a
// meaningful sample, not every game ever played. Oldest entries drop
// off first once the cap is hit (see addEntries below).
const MAX_GAMES = 300;

function readStoredGames(): GameHistoryEntry[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStoredGames(games: GameHistoryEntry[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(games));
  } catch {
    // Storage can fail (private browsing, quota) - the in-memory state
    // still updates for this session either way.
  }
}

/** The persisted history of completed games (imported or played live
 * against Stockfish) that the statistics page's personality traits are
 * computed from. Starts empty on the server/first client render (avoids
 * a hydration mismatch) and hydrates from storage right after mount,
 * same pattern as useAiProviderConfig. */
export function useGameHistory() {
  const [games, setGames] = useState<GameHistoryEntry[]>([]);

  useEffect(() => {
    setGames(readStoredGames());
  }, []);

  // Reads `games` directly (not the setState-updater form) rather than
  // returning a count mutated inside an updater callback, which isn't
  // guaranteed to have run yet by the time this returns - fine here
  // since nothing calls this concurrently with itself. Skips anything
  // whose fingerprint already exists, in `games` or earlier in this same
  // batch, so neither a duplicate within one paste nor a re-import of an
  // already-recorded game can double-count in the stats. Returns how
  // many were actually added, for the caller's own result messaging.
  function addEntries(entries: GameHistoryEntry[]): number {
    if (entries.length === 0) return 0;

    const seen = new Set(games.map((g) => g.fingerprint));
    const deduped: GameHistoryEntry[] = [];
    for (const entry of entries) {
      if (seen.has(entry.fingerprint)) continue;
      seen.add(entry.fingerprint);
      deduped.push(entry);
    }
    if (deduped.length === 0) return 0;

    const next = [...games, ...deduped].slice(-MAX_GAMES);
    setGames(next);
    writeStoredGames(next);
    return deduped.length;
  }

  function addGame(entry: GameHistoryEntry): boolean {
    return addEntries([entry]) > 0;
  }

  function clearHistory() {
    setGames([]);
    writeStoredGames([]);
  }

  return { games, addGame, addGames: addEntries, clearHistory };
}
