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

  function addEntries(entries: GameHistoryEntry[]) {
    if (entries.length === 0) return;
    setGames((prev) => {
      const next = [...prev, ...entries].slice(-MAX_GAMES);
      writeStoredGames(next);
      return next;
    });
  }

  function addGame(entry: GameHistoryEntry) {
    addEntries([entry]);
  }

  function clearHistory() {
    setGames([]);
    writeStoredGames([]);
  }

  return { games, addGame, addGames: addEntries, clearHistory };
}
