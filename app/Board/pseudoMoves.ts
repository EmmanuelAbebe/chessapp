// pseudoMoves.ts

import { Board, Square, Color, CastlingRights, Move } from "./types";
import { isWhite, inBounds, pieceColor } from "./utils";

/**
 * PSEUDO moves for a single square (no self-check filtering).
 */
export function generatePseudoMoves(
  board: Board,
  from: Square,
  sideToMove: Color,
  castling: CastlingRights,
  enPassantTarget: Square | null
): Move[] {
  const { row, col } = from;
  const piece = board[row][col];
  if (!piece) return [];
  if (pieceColor(piece) !== sideToMove) return [];

  const type = piece.toUpperCase();

  switch (type) {
    case "P":
      return pawnMoves(board, from, sideToMove, enPassantTarget);
    case "N":
      return knightMoves(board, from, sideToMove);
    case "B":
      return bishopMoves(board, from, sideToMove);
    case "R":
      return rookMoves(board, from, sideToMove);
    case "Q":
      return queenMoves(board, from, sideToMove);
    case "K":
      return kingMoves(board, from, sideToMove, castling);
    default:
      return [];
  }
}

/**
 * LEGAL moves for a single square (filters out self-check, including castling rules).
 */
export function generateLegalMovesForSquare(
  board: Board,
  from: Square,
  sideToMove: Color,
  castling: CastlingRights,
  enPassantTarget: Square | null
): Move[] {
  const pseudo = generatePseudoMoves(
    board,
    from,
    sideToMove,
    castling,
    enPassantTarget
  );
  const enemy: Color = sideToMove === "white" ? "black" : "white";

  return pseudo.filter((m) => {
    // Special handling for castling: starting, passing, and destination squares
    // must not be attacked by the enemy.
    if (m.castling) {
      const row = from.row;
      const cols =
        m.castling === "king"
          ? [4, 5, 6] // e1, f1, g1 or e8, f8, g8
          : [4, 3, 2]; // e1, d1, c1 or e8, d8, c8

      for (const col of cols) {
        if (squareAttackedBy(board, { row, col }, enemy)) {
          return false;
        }
      }
    }

    // Standard "king may not be in check after move" filter
    const nb = makeMove(board, m);
    return !kingInCheck(nb, sideToMove);
  });
}

// ----------------------
// Piece move generators
// ----------------------

function pawnMoves(
  board: Board,
  from: Square,
  side: Color,
  enPassantTarget: Square | null
): Move[] {
  const moves: Move[] = [];
  const { row: r, col: c } = from;

  const dir = side === "white" ? -1 : 1;
  const startRow = side === "white" ? 6 : 1;

  // single push
  const one = r + dir;
  if (inBounds(one, c) && !board[one][c]) {
    if (one === 0 || one === 7) {
      // promotions: only queen for now
      moves.push({ from, to: { row: one, col: c }, promotion: "Q" });
    } else {
      moves.push({ from, to: { row: one, col: c } });
    }

    // double push
    const two = r + 2 * dir;
    if (r === startRow && inBounds(two, c) && !board[two][c]) {
      moves.push({
        from,
        to: { row: two, col: c },
        doublePawn: true,
      });
    }
  }

  // captures (including en passant)
  for (const dc of [-1, 1]) {
    const nr = r + dir;
    const nc = c + dc;
    if (!inBounds(nr, nc)) continue;

    const target = board[nr][nc];
    if (target && pieceColor(target) !== side) {
      if (nr === 0 || nr === 7) {
        moves.push({
          from,
          to: { row: nr, col: nc },
          promotion: "Q",
        });
      } else {
        moves.push({
          from,
          to: { row: nr, col: nc },
        });
      }
    }

    // en passant capture: destination equals enPassantTarget
    if (
      enPassantTarget &&
      nr === enPassantTarget.row &&
      nc === enPassantTarget.col &&
      !target // destination must be empty
    ) {
      moves.push({
        from,
        to: { row: nr, col: nc },
        enPassant: true,
      });
    }
  }

  return moves;
}

function knightMoves(board: Board, from: Square, side: Color): Move[] {
  const moves: Move[] = [];
  const { row: r, col: c } = from;
  const deltas = [
    [-2, -1],
    [-2, 1],
    [-1, -2],
    [-1, 2],
    [1, -2],
    [1, 2],
    [2, -1],
    [2, 1],
  ];

  for (const [dr, dc] of deltas) {
    const nr = r + dr;
    const nc = c + dc;
    if (!inBounds(nr, nc)) continue;

    const target = board[nr][nc];
    if (!target || pieceColor(target) !== side) {
      moves.push({ from, to: { row: nr, col: nc } });
    }
  }

  return moves;
}

function slidingMoves(
  board: Board,
  from: Square,
  side: Color,
  directions: [number, number][]
): Move[] {
  const moves: Move[] = [];
  const { row: r, col: c } = from;

  for (const [dr, dc] of directions) {
    let nr = r + dr;
    let nc = c + dc;

    while (inBounds(nr, nc)) {
      const target = board[nr][nc];
      if (!target) {
        moves.push({ from, to: { row: nr, col: nc } });
      } else {
        if (pieceColor(target) !== side) {
          moves.push({ from, to: { row: nr, col: nc } });
        }
        break;
      }

      nr += dr;
      nc += dc;
    }
  }

  return moves;
}

function bishopMoves(board: Board, from: Square, side: Color): Move[] {
  return slidingMoves(board, from, side, [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ]);
}

function rookMoves(board: Board, from: Square, side: Color): Move[] {
  return slidingMoves(board, from, side, [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ]);
}

function queenMoves(board: Board, from: Square, side: Color): Move[] {
  return slidingMoves(board, from, side, [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ]);
}

function kingMoves(
  board: Board,
  from: Square,
  side: Color,
  castling: CastlingRights
): Move[] {
  const moves: Move[] = [];
  const { row: r, col: c } = from;

  // normal king steps
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (!inBounds(nr, nc)) continue;

      const target = board[nr][nc];
      if (!target || pieceColor(target) !== side) {
        moves.push({ from, to: { row: nr, col: nc } });
      }
    }
  }

  // Castling rights here generate pseudo castling moves.
  // Filtering for check is done at the caller level using kingInCheck
  // and squareAttackedBy (see generateLegalMovesForSquare).
  const row = side === "white" ? 7 : 0;
  if (r === row && c === 4) {
    // king-side
    const K = side === "white" ? castling.K : castling.k;
    if (K && board[row][5] === null && board[row][6] === null) {
      moves.push({
        from,
        to: { row, col: 6 },
        castling: "king",
      });
    }

    // queen-side
    const Q = side === "white" ? castling.Q : castling.q;
    if (
      Q &&
      board[row][1] === null &&
      board[row][2] === null &&
      board[row][3] === null
    ) {
      moves.push({
        from,
        to: { row, col: 2 },
        castling: "queen",
      });
    }
  }

  return moves;
}

// ----------------------
// Check / attack logic
// ----------------------

export function findKing(board: Board, side: Color): Square | null {
  const wantWhite = side === "white";
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p) continue;
      if (p.toUpperCase() === "K" && isWhite(p) === wantWhite) {
        return { row: r, col: c };
      }
    }
  }
  return null;
}

/**
 * Return true if target square is attacked by `bySide`.
 * This does NOT consider castling, only normal moves and pawn attacks.
 */
export function squareAttackedBy(
  board: Board,
  target: Square,
  bySide: Color
): boolean {
  const { row: tr, col: tc } = target;

  const enemyIsWhite = bySide === "white";

  // Pawn attacks
  // White pawns move up (row - 1), so they attack from one row BELOW the target.
  // Black pawns move down (row + 1), so they attack from one row ABOVE the target.
  const pawnDir = enemyIsWhite ? 1 : -1; // FIXED: white pawns are at tr + 1, black at tr - 1
  const pawnRow = tr + pawnDir;
  for (const dc of [-1, 1]) {
    const pc = tc + dc;
    if (!inBounds(pawnRow, pc)) continue;
    const p = board[pawnRow][pc];
    if (!p) continue;
    if (p.toUpperCase() === "P" && isWhite(p) === enemyIsWhite) {
      return true;
    }
  }

  // Knights
  const knightDeltas = [
    [-2, -1],
    [-2, 1],
    [-1, -2],
    [-1, 2],
    [1, -2],
    [1, 2],
    [2, -1],
    [2, 1],
  ];
  for (const [dr, dc] of knightDeltas) {
    const nr = tr + dr;
    const nc = tc + dc;
    if (!inBounds(nr, nc)) continue;
    const p = board[nr][nc];
    if (!p) continue;
    if (p.toUpperCase() === "N" && isWhite(p) === enemyIsWhite) {
      return true;
    }
  }

  // Sliding pieces: bishops / rooks / queens
  const directions: [number, number, ("B" | "R" | "Q")[]][] = [
    [-1, -1, ["B", "Q"]],
    [-1, 1, ["B", "Q"]],
    [1, -1, ["B", "Q"]],
    [1, 1, ["B", "Q"]],
    [-1, 0, ["R", "Q"]],
    [1, 0, ["R", "Q"]],
    [0, -1, ["R", "Q"]],
    [0, 1, ["R", "Q"]],
  ];

  for (const [dr, dc, pieces] of directions) {
    let nr = tr + dr;
    let nc = tc + dc;
    while (inBounds(nr, nc)) {
      const p = board[nr][nc];
      if (!p) {
        nr += dr;
        nc += dc;
        continue;
      }
      if (isWhite(p) !== enemyIsWhite) break;
      const kind = p.toUpperCase();
      if (pieces.includes(kind as "B" | "R" | "Q")) return true;
      break;
    }
  }

  // King adjacency
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = tr + dr;
      const nc = tc + dc;
      if (!inBounds(nr, nc)) continue;
      const p = board[nr][nc];
      if (!p) continue;
      if (p.toUpperCase() === "K" && isWhite(p) === enemyIsWhite) {
        return true;
      }
    }
  }

  return false;
}

/**
 * True if `side`'s king is currently in check.
 */
export function kingInCheck(board: Board, side: Color): boolean {
  const kingSq = findKing(board, side);
  if (!kingSq) return false; // invalid position
  const enemy = side === "white" ? "black" : "white";
  return squareAttackedBy(board, kingSq, enemy);
}

// ----------------------
// Apply move
// ----------------------

export function makeMove(board: Board, move: Move): Board {
  const newBoard: Board = board.map((row) => row.slice());
  const p = newBoard[move.from.row][move.from.col];
  newBoard[move.from.row][move.from.col] = null;

  // en passant capture: captured pawn is on from.row, to.col
  if (move.enPassant && p && p.toUpperCase() === "P") {
    const captureRow = move.from.row;
    const captureCol = move.to.col;
    newBoard[captureRow][captureCol] = null;
  }

  // castling rook move
  if (move.castling && p && p.toUpperCase() === "K") {
    const row = move.from.row;
    if (move.castling === "king") {
      // e1 -> g1 (white) or e8 -> g8 (black)
      // rook: h-file -> f-file
      newBoard[row][5] = newBoard[row][7];
      newBoard[row][7] = null;
    } else if (move.castling === "queen") {
      // e1 -> c1 or e8 -> c8
      // rook: a-file -> d-file
      newBoard[row][3] = newBoard[row][0];
      newBoard[row][0] = null;
    }
  }

  // promotion
  if (move.promotion && p && p.toUpperCase() === "P") {
    const promoPiece = isWhite(p)
      ? move.promotion.toUpperCase()
      : move.promotion.toLowerCase();
    newBoard[move.to.row][move.to.col] = promoPiece;
  } else {
    newBoard[move.to.row][move.to.col] = p;
  }

  return newBoard;
}
