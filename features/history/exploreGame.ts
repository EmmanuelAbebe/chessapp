import type { GameHistoryEntry } from "./types";

// Hand-off for "explore this game on the board / map". The Statistics
// page lives outside the (game) route group, so it can't touch the board
// game context directly - it drops the game here, navigates, and the
// BoardGameProvider picks it up on mount (see its effect).

const KEY = "chessapp:explore-game";
const FEN_KEY = "chessapp:explore-fen";

export type ExploreGamePayload = {
  moves: GameHistoryEntry["moves"];
  playerSide: "w" | "b";
};

export function stashExploreGame(game: GameHistoryEntry): void {
  try {
    sessionStorage.setItem(
      KEY,
      JSON.stringify({ moves: game.moves, playerSide: game.playerSide }),
    );
  } catch {
    // sessionStorage can be unavailable (private mode, storage disabled);
    // the navigation still happens, just without the game loaded.
  }
}

/** Reads and clears the stashed game - call once, on entering (game). */
export function takeExploreGame(): ExploreGamePayload | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    sessionStorage.removeItem(KEY);
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.moves)) return null;
    return {
      moves: parsed.moves,
      playerSide: parsed.playerSide === "b" ? "b" : "w",
    };
  } catch {
    return null;
  }
}

// Same hand-off, for "see this position on the board" - a player-model
// focus area's example position only carries a FEN (features/playermodel/
// types.ts's ExamplePosition), not a full game, so there's no move list
// to jump into - just the one position, in analysis mode.
export function stashExploreFen(fen: string): void {
  try {
    sessionStorage.setItem(FEN_KEY, fen);
  } catch {
    // sessionStorage can be unavailable (private mode, storage disabled);
    // the navigation still happens, just without the position loaded.
  }
}

export function takeExploreFen(): string | null {
  try {
    const fen = sessionStorage.getItem(FEN_KEY);
    if (!fen) return null;
    sessionStorage.removeItem(FEN_KEY);
    return fen;
  } catch {
    return null;
  }
}
