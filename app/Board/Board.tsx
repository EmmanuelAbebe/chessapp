"use client";

import { useState, useRef, useEffect } from "react";
import { fenToBoard, pieceColor, inBounds } from "./utils";
import {
  BoardProps,
  CastlingRights,
  Color,
  Move,
  Piece,
  Square,
} from "./types";
import { Board as BoardType } from "./types";
import {
  generatePseudoMoves,
  makeMove,
  kingInCheck,
  findKing,
  squareAttackedBy,
} from "./pseudoMoves";

function parseInitialState(fen: string): {
  board: BoardType;
  sideToMove: Color;
  castling: CastlingRights;
  enPassant: Square | null;
} {
  const board = fenToBoard(fen);
  const parts = fen.trim().split(/\s+/);

  const sideToMove: Color = parts[1] === "b" ? "black" : "white";

  const castlingStr = parts[2] ?? "-";
  const castling: CastlingRights = {
    K: castlingStr.includes("K"),
    Q: castlingStr.includes("Q"),
    k: castlingStr.includes("k"),
    q: castlingStr.includes("q"),
  };

  const epStr = parts[3] ?? "-";
  let enPassant: Square | null = null;
  if (epStr !== "-" && epStr.length === 2) {
    const file = epStr.charCodeAt(0) - "a".charCodeAt(0);
    const rank = Number(epStr[1]);
    const row = 8 - rank;
    const col = file;
    if (inBounds(row, col)) {
      enPassant = { row, col };
    }
  }

  return { board, sideToMove, castling, enPassant };
}

export default function Board({ fen, onHumanMove }: BoardProps) {
  const init = parseInitialState(fen);

  const [board, setBoard] = useState<BoardType>(init.board);
  const [sideToMove, setSideToMove] = useState<Color>(init.sideToMove);
  const [castling, setCastling] = useState<CastlingRights>(init.castling);
  const [enPassantTarget, setEnPassantTarget] = useState<Square | null>(
    init.enPassant
  );

  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [legalMoves, setLegalMoves] = useState<Move[]>([]);

  const boardRef = useRef<HTMLDivElement | null>(null);

  const [dragState, setDragState] = useState<{
    from: Square;
    piece: string;
    xPct: number; // cursor position relative to board (percent)
    yPct: number;
  } | null>(null);

  const startDragFromPiece = (
    e: React.MouseEvent<HTMLDivElement>,
    p: Piece
  ) => {
    e.preventDefault();
    e.stopPropagation();
    if (!boardRef.current) return;

    // Only drag side-to-move pieces
    if (pieceColor(p.type) !== sideToMove) return;

    const rect = boardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const xPct = (x / rect.width) * 100;
    const yPct = (y / rect.height) * 100;

    const from: Square = { row: p.row, col: p.col };

    // Select piece and show its legal moves
    setSelectedSquare(from);
    setLegalMoves(generateLegalMovesForSquare(from));

    setDragState({
      from,
      piece: p.type,
      xPct,
      yPct,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragState || !boardRef.current) return;

    const rect = boardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const xPct = (x / rect.width) * 100;
    const yPct = (y / rect.height) * 100;

    setDragState((prev) => (prev ? { ...prev, xPct, yPct } : prev));
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!dragState) return;

    const sq = getSquareFromEvent(e);
    setDragState(null);

    if (!sq) {
      // dropped outside board → cancel selection
      setSelectedSquare(null);
      setLegalMoves([]);
      return;
    }

    // Reuse your existing click-to-move logic
    handleLeftClick(sq);
  };

  // Re-initialize if FEN prop changes
  useEffect(() => {
    const next = parseInitialState(fen);
    setBoard(next.board);
    setSideToMove(next.sideToMove);
    setCastling(next.castling);
    setEnPassantTarget(next.enPassant);
    setSelectedSquare(null);
    setLegalMoves([]);
  }, [fen]);

  const squaresFromBoard: Piece[] = board
    .flatMap((row, r) =>
      row.map((cell, c) =>
        cell
          ? {
              id: `${r}-${c}`,
              row: r,
              col: c,
              type: cell,
            }
          : null
      )
    )
    .filter(Boolean) as Piece[];

  // Mouse → grid coords
  const getSquareFromEvent = (e: React.MouseEvent): Square | null => {
    if (!boardRef.current) return null;
    const rect = boardRef.current.getBoundingClientRect();
    const size = rect.width / 8;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const col = Math.floor(x / size);
    const row = Math.floor(y / size);
    if (!inBounds(row, col)) return null;
    return { row, col };
  };

  // Legal moves for a specific square
  const generateLegalMovesForSquare = (sq: Square): Move[] => {
    const piece = board[sq.row][sq.col];
    if (!piece || pieceColor(piece) !== sideToMove) return [];

    const pseudo = generatePseudoMoves(
      board,
      sq,
      sideToMove,
      castling,
      enPassantTarget
    );

    return pseudo.filter((m) => {
      const nb = makeMove(board, m);
      return !kingInCheck(nb, sideToMove);
    });
  };

  // LEFT click: select/move
  const handleLeftClick = (sq: Square) => {
    const { row, col } = sq;
    const piece = board[row][col];

    // Selecting own piece
    if (piece && pieceColor(piece) === sideToMove) {
      setSelectedSquare(sq);
      setLegalMoves(generateLegalMovesForSquare(sq));
      return;
    }

    // Attempting to move selected piece
    if (selectedSquare) {
      const move = legalMoves.find((m) => m.to.row === row && m.to.col === col);
      if (!move) {
        // clicked somewhere not in legal moves → deselect
        setSelectedSquare(null);
        setLegalMoves([]);
        return;
      }

      const movingPiece = board[move.from.row][move.from.col];

      const newBoard = makeMove(board, move);

      // Update en-passant target
      if (move.enPassant) {
        setEnPassantTarget(null);
      } else if (move.doublePawn) {
        // target square is the "skipped" square (between from and to)
        const epRow = (move.from.row + move.to.row) / 2;
        setEnPassantTarget({
          row: epRow,
          col: move.to.col,
        });
      } else {
        setEnPassantTarget(null);
      }

      // Update castling rights when king or rook moves
      let nextCastling: CastlingRights = { ...castling };

      if (movingPiece) {
        if (movingPiece === "K") {
          nextCastling.K = false;
          nextCastling.Q = false;
        } else if (movingPiece === "k") {
          nextCastling.k = false;
          nextCastling.q = false;
        } else if (movingPiece === "R") {
          if (move.from.row === 7 && move.from.col === 0)
            nextCastling.Q = false;
          if (move.from.row === 7 && move.from.col === 7)
            nextCastling.K = false;
        } else if (movingPiece === "r") {
          if (move.from.row === 0 && move.from.col === 0)
            nextCastling.q = false;
          if (move.from.row === 0 && move.from.col === 7)
            nextCastling.k = false;
        }
      }

      // If we actually castle, rights are gone for that side
      if (move.castling) {
        if (sideToMove === "white") {
          nextCastling.K = false;
          nextCastling.Q = false;
        } else {
          nextCastling.k = false;
          nextCastling.q = false;
        }
      }

      setCastling(nextCastling);
      setBoard(newBoard);
      setSideToMove(sideToMove === "white" ? "black" : "white");
      setSelectedSquare(null);
      setLegalMoves([]);
    }
  };

  const handleBoardClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (dragState) return; // ignore click events coming from a drag
    const sq = getSquareFromEvent(e);
    if (!sq) return;
    if (e.button === 0) {
      handleLeftClick(sq);
    }
  };

  const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const ranks = ["1", "2", "3", "4", "5", "6", "7", "8"];

  const enemySide: Color = sideToMove === "white" ? "black" : "white";

  // Current king square for side to move
  const kingSquare = findKing(board, sideToMove);

  // Is that king in check right now?
  const kingIsInCheck =
    kingSquare !== null
      ? squareAttackedBy(board, kingSquare, enemySide)
      : false;

  // Squares of our pieces currently attacked by the enemy
  const attackedSquares: Square[] = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p) continue;

      const pieceSide: Color = p === p.toUpperCase() ? "white" : "black";
      if (pieceSide !== sideToMove) continue;

      const sq: Square = { row: r, col: c };
      if (squareAttackedBy(board, sq, enemySide)) {
        attackedSquares.push(sq);
      }
    }
  }

  return (
    <div
      ref={boardRef}
      className="relative w-full max-w-[480px] aspect-square bg-chessboard select-none"
      onClick={handleBoardClick}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Legal-move dots */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 8 8"
      >
        {/* attacked pieces (side to move) */}
        <g>
          {attackedSquares.map((sq, i) => (
            <rect
              key={`attacked-${i}`}
              x={sq.col}
              y={sq.row}
              width={1}
              height={1}
              fill="rgba(255, 215, 0, 0.35)" // gold-ish
            />
          ))}
        </g>

        {/* king in check */}
        <g>
          {kingSquare && kingIsInCheck && (
            <rect
              x={kingSquare.col}
              y={kingSquare.row}
              width={1}
              height={1}
              fill="rgba(255, 0, 0, 0.45)" // red highlight
            />
          )}
        </g>

        {/* selection + legal move dots */}
        <g>
          {selectedSquare && (
            <rect
              x={selectedSquare.col}
              y={selectedSquare.row}
              width={1}
              height={1}
              fill="rgba(0, 255, 0, 0.25)"
            />
          )}
          {legalMoves.map((m, i) => (
            // <circle
            //   key={i}
            //   cx={m.to.col + 0.5}
            //   cy={m.to.row + 0.5}
            //   r={0.15}
            //   fill="rgba(0, 162, 255, 0.8)"
            // />
            <rect
              key={i}
              x={m.to.col}
              y={m.to.row}
              width={1}
              height={1}
              fill="rgba(0, 162, 255, 0.8)"
            />
          ))}
        </g>

        {/* file letters (a–h) on bottom inside each square */}
        <g>
          {files.map((f, col) => (
            <text
              key={`file-${f}`}
              x={col + 0.8} // center of file
              y={7.8} // inside rank-1 square (row 7..8)
              textAnchor="start"
              dominantBaseline="hanging"
              fontSize={0.2}
              fill="black"
            >
              {f}
            </text>
          ))}
        </g>

        {/* rank numbers (1–8) on the left inside each square */}
        <g>
          {ranks.map((r, i) => {
            const rowFromTop = 7 - i; // rank 1 at row 7, rank 8 at row 0
            return (
              <text
                key={`rank-${r}`}
                x={0.2} // inside file "a" square
                y={rowFromTop + 0.1} // center of that row
                textAnchor="end"
                dominantBaseline="hanging"
                fontSize={0.2}
                fill="black"
              >
                {r}
              </text>
            );
          })}
        </g>
      </svg>

      {/* Pieces */}
      {squaresFromBoard.map((p) => {
        const isDragging =
          dragState &&
          dragState.from.row === p.row &&
          dragState.from.col === p.col;

        const style = isDragging
          ? {
              position: "absolute" as const,
              top: `${dragState!.yPct}%`,
              left: `${dragState!.xPct}%`,
              transform: "translate(-50%, -50%)",
              zIndex: 20,
              pointerEvents: "none" as const,
            }
          : {
              position: "absolute" as const,
              top: `${p.row * 12.5}%`,
              left: `${p.col * 12.5}%`,
            };

        return (
          <div
            key={p.id}
            className={`piece piece-${p.type}`}
            style={style}
            onMouseDown={(e) => startDragFromPiece(e, p)}
          />
        );
      })}
    </div>
  );
}
