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

  // Skips anything whose fingerprint already exists (in prior history or
  // earlier in this same batch) so a re-import can't double-count - but a
  // re-import of an already-recorded game DOES backfill richer detail
  // (meta / a real played-at) onto the stored copy when the incoming one
  // has it and the stored one doesn't, so importing before the game-
  // detail feature existed can be fixed by just importing again. Returns
  // how many were genuinely new.
  function addEntries(entries: GameHistoryEntry[]): number {
    if (entries.length === 0) return 0;

    const incomingByFp = new Map<string, GameHistoryEntry>();
    for (const e of entries) {
      if (!incomingByFp.has(e.fingerprint)) incomingByFp.set(e.fingerprint, e);
    }

    let enriched = false;
    const merged = gamesRef.current.map((stored) => {
      const incoming = incomingByFp.get(stored.fingerprint);
      const storedHasMeta =
        stored.meta && Object.keys(stored.meta).length > 0;
      const incomingHasMeta =
        incoming?.meta && Object.keys(incoming.meta).length > 0;
      if (incoming && incomingHasMeta && !storedHasMeta) {
        enriched = true;
        return {
          ...stored,
          meta: incoming.meta,
          playedAt: incoming.playedAt,
          timeControl: stored.timeControl ?? incoming.timeControl,
        };
      }
      return stored;
    });

    const existingFps = new Set(gamesRef.current.map((g) => g.fingerprint));
    const additions: GameHistoryEntry[] = [];
    for (const entry of incomingByFp.values()) {
      if (existingFps.has(entry.fingerprint)) continue;
      existingFps.add(entry.fingerprint);
      additions.push(entry);
    }

    if (additions.length === 0 && !enriched) return 0;

    const next = [...merged, ...additions].slice(-MAX_GAMES);
    gamesRef.current = next;
    setGames(next);
    writeStoredGames(next);
    return additions.length;
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
