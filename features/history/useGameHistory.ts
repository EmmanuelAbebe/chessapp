"use client";

import { useEffect, useRef, useState } from "react";
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
  // The actual source of truth `addEntries` reads/writes, updated
  // synchronously and immediately on every call - a plain state variable
  // read via closure isn't safe here, since a long-running incremental
  // import (features/board/lib/pgn-import-stream.ts) calls the very same
  // `addGames` reference many times across many React re-renders, and a
  // stale `games` snapshot from whichever render created that closure
  // would make each call overwrite the last instead of accumulating.
  // Mutating a ref has none of that timing dependency.
  const gamesRef = useRef<GameHistoryEntry[]>([]);

  useEffect(() => {
    const stored = readStoredGames();
    gamesRef.current = stored;
    setGames(stored);
  }, []);

  // Skips anything whose fingerprint already exists, in prior history or
  // earlier in this same batch, so neither a duplicate within one paste
  // nor a re-import of an already-recorded game can double-count in the
  // stats. Returns how many were actually added, for the caller's own
  // result messaging.
  function addEntries(entries: GameHistoryEntry[]): number {
    if (entries.length === 0) return 0;

    const seen = new Set(gamesRef.current.map((g) => g.fingerprint));
    const deduped: GameHistoryEntry[] = [];
    for (const entry of entries) {
      if (seen.has(entry.fingerprint)) continue;
      seen.add(entry.fingerprint);
      deduped.push(entry);
    }
    if (deduped.length === 0) return 0;

    const next = [...gamesRef.current, ...deduped].slice(-MAX_GAMES);
    gamesRef.current = next;
    setGames(next);
    writeStoredGames(next);
    return deduped.length;
  }

  function addGame(entry: GameHistoryEntry): boolean {
    return addEntries([entry]) > 0;
  }

  function clearHistory() {
    gamesRef.current = [];
    setGames([]);
    writeStoredGames([]);
  }

  return { games, addGame, addGames: addEntries, clearHistory };
}
