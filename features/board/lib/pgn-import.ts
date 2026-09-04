import { Chess } from "chess.js";
import { appendChildNode, createMoveTree, findChildByUci } from "./move-tree";
import type { MoveTreeState } from "../types";

export type ImportedGameInfo = {
  white: string;
  black: string;
  whiteElo?: string;
  blackElo?: string;
  result: string;
  timeControl?: string;
  event?: string;
  date?: string;
};

export type ImportPgnResult = {
  tree: MoveTreeState;
  info: ImportedGameInfo;
  moves: ParsedMove[];
};

export type ParsedMove = {
  san: string;
  uci: string;
  fen: string;
  side: "w" | "b";
  comment?: string;
};

export type ParsedGame = {
  headers: Record<string, string>;
  moves: ParsedMove[];
};

// Lichess exports (and PGN in general) carry per-move annotations as a
// "{ ... }" comment right after the move - `{ [%clk 0:03:00] }` for clock
// time. Only the clock is surfaced today; other tags (%eval, %csl, %cal)
// are left in place for later rather than stripped, since a raw comment
// with an unrecognized tag is harmless to keep around unused.
function parseClock(comment: string | undefined): string | undefined {
  return comment?.match(/%clk\s+(\d+:\d+:\d+)/)?.[1];
}

/** Matches a game's White/Black headers against a saved list of the
 * player's own usernames (case-insensitive) - the "which side was I"
 * question every history entry needs answered before it can be
 * attributed to the player rather than the opponent. `null` when none
 * of the saved names match either header. */
export function matchPlayerSide(
  headers: Record<string, string>,
  usernames: string[],
): "w" | "b" | null {
  const normalized = usernames.map((name) => name.trim().toLowerCase()).filter(Boolean);
  if (normalized.length === 0) return null;

  const white = headers.White?.trim().toLowerCase();
  const black = headers.Black?.trim().toLowerCase();

  if (white && normalized.includes(white)) return "w";
  if (black && normalized.includes(black)) return "b";
  return null;
}

/** Parses one game's headers + move list via chess.js. Throws (chess.js's
 * own error) for anything structurally invalid. */
export function parseGame(pgn: string): ParsedGame {
  const chess = new Chess();
  chess.loadPgn(pgn.trim());

  const headers = chess.getHeaders();
  const history = chess.history({ verbose: true });
  const comments = new Map(chess.getComments().map((c) => [c.fen, c.comment]));

  const moves = history.map((move) => ({
    san: move.san,
    uci: `${move.from}${move.to}${move.promotion ?? ""}`,
    fen: move.after,
    side: move.color,
    comment: parseClock(comments.get(move.after)),
  }));

  return { headers, moves };
}

/** A bulk PGN export (lichess's "download all games" included) is just
 * every game's PGN back to back, with or without a blank line between
 * them. Splitting right before each "[Event " tag handles both. */
function splitPgnGames(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const parts = trimmed
    .split(/(?=\[Event\s)/i)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : [trimmed];
}

/** Parses a single full PGN - headers plus the move list - into a ready-
 * to-use move tree, the same shape a live game builds one move at a time.
 * Throws (chess.js's own error) for anything structurally invalid. */
export function importPgn(pgn: string): ImportPgnResult {
  const { headers, moves } = parseGame(pgn);

  let tree = createMoveTree();
  let parentId = tree.rootId;

  for (const move of moves) {
    tree = appendChildNode(tree, parentId, move);
    parentId = tree.currentNodeId;
  }

  // Land back at the start - reviewing an imported game means stepping
  // through it from move 1, not landing on the final position.
  tree = { ...tree, currentNodeId: tree.rootId };

  return {
    tree,
    moves,
    info: {
      white: headers.White || "White",
      black: headers.Black || "Black",
      whiteElo: headers.WhiteElo,
      blackElo: headers.BlackElo,
      result: headers.Result || "*",
      timeControl: headers.TimeControl,
      event: headers.Event,
      date: headers.UTCDate || headers.Date,
    },
  };
}

export type MergeGamesResult = {
  tree: MoveTreeState;
  gamesImported: number;
  gamesFailed: number;
  // Every successfully parsed game, headers included - lets a caller
  // (the map's bulk-import modal) attribute individual games to game
  // history without re-parsing the same pasted text a second time.
  parsedGames: ParsedGame[];
};

/** Merges many games (one pasted block, lichess bulk-export style) into an
 * existing tree instead of replacing it - shared openings/transpositions
 * fold into the same branch (findChildByUci reuses a move that's already
 * there), and each game only forks off new nodes where it actually
 * diverges from everything merged in so far. Built for the map page,
 * where the point is growing one combined tree out of many games rather
 * than reviewing any single one of them. A game that fails to parse is
 * skipped rather than aborting the whole batch. */
export function mergeGamesIntoTree(baseTree: MoveTreeState, pgnText: string): MergeGamesResult {
  let tree = baseTree;
  let gamesImported = 0;
  let gamesFailed = 0;
  const parsedGames: ParsedGame[] = [];

  for (const gamePgn of splitPgnGames(pgnText)) {
    let game: ParsedGame;
    try {
      game = parseGame(gamePgn);
    } catch {
      gamesFailed++;
      continue;
    }

    let parentId = tree.rootId;
    for (const move of game.moves) {
      const existingChildId = findChildByUci(tree, parentId, move.uci);
      if (existingChildId) {
        parentId = existingChildId;
        continue;
      }
      tree = appendChildNode(tree, parentId, move);
      parentId = tree.currentNodeId;
    }
    parsedGames.push(game);
    gamesImported++;
  }

  // Leave the cursor wherever it already was rather than jumping to
  // wherever the last merged game happened to end - this is about
  // growing the shared tree, not "going" anywhere in particular.
  tree = { ...tree, currentNodeId: baseTree.currentNodeId };

  return { tree, gamesImported, gamesFailed, parsedGames };
}
