import { Chess, type Square } from "chess.js";
import { detectHangingPieces } from "@/features/board/lib/board-tactics";
import { detectGamePhase, type GamePhase } from "@/features/board/lib/move-analysis";
import {
  appendChildNode,
  createMoveTree,
  findChildByUci,
} from "@/features/board/lib/move-tree";
import type { GameHistoryEntry } from "@/features/history/types";
import type { ParsedMove } from "@/features/board/lib/pgn-import";

// Every trait here is computed purely from move notation and PGN clock
// annotations - no Stockfish involved, so they're instant regardless of
// how much history has piled up. Traits that would need real move-quality
// judgment (was this actually the engine's best move, did accuracy hold
// up under time pressure, did they recover well after a blunder) need a
// batch-analysis pass this app doesn't have yet - a deliberate v1 scope
// cut, not an oversight. Every result below carries a `method` string
// naming exactly what was counted, since these are interpretive
// heuristics standing in for real personality traits, not hard science.

export type TraitResult = {
  key: string;
  label: string;
  score: number; // 0-100, higher = more of the trait
  method: string;
};

const PIECE_VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 };

function clamp(n: number): number {
  return Math.max(0, Math.min(100, n));
}

function playerMoves(game: GameHistoryEntry): ParsedMove[] {
  return game.moves.filter((move) => move.side === game.playerSide);
}

function totalPlayerMoves(games: GameHistoryEntry[]): number {
  return games.reduce((sum, game) => sum + playerMoves(game).length, 0);
}

/** Rate of captures/checks among the player's own moves - a cheap,
 * notation-only proxy for how often they seek out contact and forcing
 * sequences rather than quiet maneuvering. */
export function computeAggression(games: GameHistoryEntry[]): TraitResult | null {
  let sharp = 0;
  let total = 0;
  for (const game of games) {
    for (const move of playerMoves(game)) {
      total++;
      if (move.san.includes("x") || /[+#]$/.test(move.san)) sharp++;
    }
  }
  if (total === 0) return null;

  const rate = (sharp / total) * 100;
  // A genuinely sharp player rarely clears ~35% of moves as captures/
  // checks - scaled so that reads near the top of the dial instead of
  // leaving the whole scale unused.
  return {
    key: "aggression",
    label: "Aggression",
    score: clamp((rate / 35) * 100),
    method: `${sharp} of ${total} of your moves were captures or checks (${rate.toFixed(0)}%).`,
  };
}

function materialBalance(fen: string): number {
  let chess: Chess;
  try {
    chess = new Chess(fen);
  } catch {
    return 0;
  }
  let balance = 0;
  for (const piece of chess.board().flat()) {
    if (!piece || piece.type === "k") continue;
    const value = PIECE_VALUE[piece.type] ?? 0;
    balance += piece.color === "w" ? value : -value;
  }
  return balance;
}

/** How much the material balance see-saws across a game (total swing per
 * move, not just the final imbalance) - a risk-appetite proxy. A quiet
 * game that trades down evenly stays low; sacrifices and complications
 * push it up regardless of how the game eventually resolves. */
export function computeVolatility(games: GameHistoryEntry[]): TraitResult | null {
  let totalSwing = 0;
  let totalPlies = 0;
  for (const game of games) {
    let previous = 0; // the starting position is always material-even
    for (const move of game.moves) {
      const balance = materialBalance(move.fen);
      totalSwing += Math.abs(balance - previous);
      previous = balance;
      totalPlies++;
    }
  }
  if (totalPlies === 0) return null;

  const avgSwing = totalSwing / totalPlies;
  // A quiet game rarely averages more than ~0.3 pawns of swing per ply
  // (the occasional even trade); frequent sacrifices/complications push
  // this well past 1 - scaled so ~1.5 reads near the top of the dial.
  return {
    key: "volatility",
    label: "Volatility",
    score: clamp((avgSwing / 1.5) * 100),
    method: `Material swung by an average of ${avgSwing.toFixed(2)} pawns per move.`,
  };
}

/** Inverse of how often the player's own move left one of their pieces
 * hanging (attacked and undefended, or defended only at a material
 * loss) - reuses the same deterministic chess.js check the live board
 * already highlights hangs with. */
export function computeVigilance(games: GameHistoryEntry[]): TraitResult | null {
  let ownMoves = 0;
  let leftHanging = 0;

  for (const game of games) {
    for (const move of playerMoves(game)) {
      ownMoves++;
      let chess: Chess;
      try {
        chess = new Chess(move.fen);
      } catch {
        continue;
      }
      const hasOwnHang = detectHangingPieces(move.fen).some(
        (hanging) => chess.get(hanging.square as Square)?.color === game.playerSide,
      );
      if (hasOwnHang) leftHanging++;
    }
  }
  if (ownMoves === 0) return null;

  const hangRate = (leftHanging / ownMoves) * 100;
  // Inverted - vigilance is HIGH when hanging pieces are rare. A rate
  // above ~20% of moves would already be unusually careless.
  return {
    key: "vigilance",
    label: "Vigilance",
    score: clamp(100 - (hangRate / 20) * 100),
    method: `${leftHanging} of ${ownMoves} of your moves left a piece hanging (${hangRate.toFixed(0)}%).`,
  };
}

function parseClockSeconds(clock: string | undefined): number | null {
  const match = clock?.match(/^(\d+):(\d+):(\d+)$/);
  if (!match) return null;
  const [, h, m, s] = match;
  return Number(h) * 3600 + Number(m) * 60 + Number(s);
}

function baseSeconds(timeControl: string | undefined): number | null {
  const match = timeControl?.match(/^(\d+)\+/);
  return match ? Number(match[1]) : null;
}

/** Share of the player's own moves made with under 15% of their base
 * time left - only meaningful for games that actually carry clock data
 * (imported PGNs with lichess-style `%clk` annotations today), `null`
 * when none of the history has any. */
export function computeTimePressureTendency(games: GameHistoryEntry[]): TraitResult | null {
  let total = 0;
  let lowClock = 0;

  for (const game of games) {
    const base = baseSeconds(game.timeControl);
    if (!base) continue;
    for (const move of playerMoves(game)) {
      const remaining = parseClockSeconds(move.comment);
      if (remaining === null) continue;
      total++;
      if (remaining / base < 0.15) lowClock++;
    }
  }
  if (total === 0) return null;

  const rate = (lowClock / total) * 100;
  return {
    key: "time-pressure",
    label: "Time Pressure",
    score: clamp((rate / 30) * 100),
    method: `${lowClock} of ${total} of your clocked moves were made with under 15% of your time left (${rate.toFixed(0)}%).`,
  };
}

/** Opening diversity - merges every game's first few moves into one
 * shared tree (the exact same transposition-merging logic the map page
 * uses for bulk import) and compares how many distinct positions were
 * reached by move 4 against how many games there are. Close to 100%
 * means most games diverge quickly (an explorer); a low ratio means
 * many games funnel into the same few branches (a specialist). */
export function computeRepertoireBreadth(games: GameHistoryEntry[]): TraitResult | null {
  if (games.length === 0) return null;

  const TARGET_PLY = 8;
  let tree = createMoveTree();
  const reachedNodeIds = new Set<string>();

  for (const game of games) {
    let parentId = tree.rootId;
    for (let ply = 0; ply < TARGET_PLY && ply < game.moves.length; ply++) {
      const move = game.moves[ply];
      const existingId = findChildByUci(tree, parentId, move.uci);
      if (existingId) {
        parentId = existingId;
      } else {
        tree = appendChildNode(tree, parentId, move);
        parentId = tree.currentNodeId;
      }
    }
    reachedNodeIds.add(parentId);
  }

  const ratio = reachedNodeIds.size / games.length;
  return {
    key: "repertoire",
    label: "Repertoire",
    score: clamp(ratio * 100),
    method: `${games.length} game${games.length === 1 ? "" : "s"} reached ${reachedNodeIds.size} distinct position${reachedNodeIds.size === 1 ? "" : "s"} by move 4.`,
  };
}

export type PhaseMix = Record<GamePhase, number>;

/** Share of the player's own moves falling in each game phase - a mix,
 * not a strength-by-phase breakdown (that needs move-quality
 * classification, deferred along with the other engine-grounded
 * traits). Shown separately from the radar since it's categorical, not
 * a single spectrum. */
export function computePhaseMix(games: GameHistoryEntry[]): PhaseMix | null {
  const counts: PhaseMix = { opening: 0, middlegame: 0, endgame: 0 };
  let total = 0;

  for (const game of games) {
    game.moves.forEach((move, index) => {
      if (move.side !== game.playerSide) return;
      counts[detectGamePhase(move.fen, index + 1)]++;
      total++;
    });
  }
  if (total === 0) return null;

  return {
    opening: (counts.opening / total) * 100,
    middlegame: (counts.middlegame / total) * 100,
    endgame: (counts.endgame / total) * 100,
  };
}

export type Archetype = { title: string; blurb: string };

const DEFAULT_ARCHETYPE: Archetype = {
  title: "The Balanced Player",
  blurb: "No single trait dominates - you adapt to whatever the position calls for.",
};

// Checked in order - first match wins. Combinations before single-trait
// rules so a player who's both aggressive and volatile gets "The
// Gambler" rather than being caught by a more generic single-axis rule.
const ARCHETYPES: { match: (t: Record<string, number>) => boolean; result: Archetype }[] = [
  {
    match: (t) => (t.aggression ?? 0) >= 60 && (t.volatility ?? 0) >= 60,
    result: {
      title: "The Gambler",
      blurb: "You create chaos and dare your opponent to keep up.",
    },
  },
  {
    match: (t) => (t.vigilance ?? 0) >= 70 && (t.aggression ?? 0) <= 40,
    result: {
      title: "The Fortress",
      blurb: "Nothing gets left hanging - solid beats spectacular.",
    },
  },
  {
    match: (t) => (t["time-pressure"] ?? 0) >= 60,
    result: {
      title: "The Time Trouble Addict",
      blurb: "You live dangerously on the clock.",
    },
  },
  {
    match: (t) => (t.repertoire ?? 50) >= 75,
    result: {
      title: "The Explorer",
      blurb: "You rarely play the same opening twice.",
    },
  },
  {
    match: (t) => (t.repertoire ?? 50) <= 25,
    result: {
      title: "The Specialist",
      blurb: "A handful of openings, played deeply and often.",
    },
  },
  {
    match: (t) => (t.aggression ?? 0) <= 30 && (t.volatility ?? 0) <= 30,
    result: {
      title: "The Diplomat",
      blurb: "You keep things quiet and let small edges accumulate.",
    },
  },
];

export function computeArchetype(traits: TraitResult[]): Archetype {
  const byKey = Object.fromEntries(traits.map((t) => [t.key, t.score]));
  return ARCHETYPES.find(({ match }) => match(byKey))?.result ?? DEFAULT_ARCHETYPE;
}

export type PersonalityProfile = {
  radarTraits: TraitResult[];
  phaseMix: PhaseMix | null;
  archetype: Archetype;
  gamesCount: number;
  movesCount: number;
};

export function computePersonalityProfile(games: GameHistoryEntry[]): PersonalityProfile {
  const radarTraits = [
    computeAggression(games),
    computeVolatility(games),
    computeVigilance(games),
    computeTimePressureTendency(games),
    computeRepertoireBreadth(games),
  ].filter((trait): trait is TraitResult => trait !== null);

  return {
    radarTraits,
    phaseMix: computePhaseMix(games),
    archetype: computeArchetype(radarTraits),
    gamesCount: games.length,
    movesCount: totalPlayerMoves(games),
  };
}
