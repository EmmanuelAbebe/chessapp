"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import {
  fenToBoard,
  pieceColor,
  inBounds,
  buildFenFromPosition,
} from "./utils";
import {
  BoardProps,
  CastlingRights,
  Color,
  Move,
  Piece,
  Square,
  Board as BoardType,
  files,
  ranks,
} from "./types";
import {
  generatePseudoMoves,
  makeMove,
  kingInCheck,
  findKing,
  squareAttackedBy,
} from "./pseudoMoves";
import { parseUciMove } from "./uci";
import { useStockfishEngine } from "../../hooks/useStockfishEngine";
import { EvalBar } from "./EvalBar";
import { moveToSimpleNotation } from "./simpleMoves";
import MoveList from "./MoveList";

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

const squareToAlgebraic = (sq: Square): string => {
  const file = String.fromCharCode("a".charCodeAt(0) + sq.col);
  const rank = String(8 - sq.row);
  return file + rank;
};

const moveToUci = (m: Move): string => {
  let uci = squareToAlgebraic(m.from) + squareToAlgebraic(m.to);
  if (m.promotion) {
    uci += m.promotion.toLowerCase();
  }
  return uci;
};

export default function Board({ fen }: BoardProps) {
  const init = parseInitialState(fen);
  const [board, setBoard] = useState<BoardType>(init.board);
  const [sideToMove, setSideToMove] = useState<Color>(init.sideToMove);
  const [castling, setCastling] = useState<CastlingRights>(init.castling);
  const [enPassantTarget, setEnPassantTarget] = useState<Square | null>(
    init.enPassant
  );
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [legalMoves, setLegalMoves] = useState<Move[]>([]);
  const [lastMove, setLastMove] = useState<Move | null>(null);
  const [uciMoves, setUciMoves] = useState<string[]>([]);
  const [simpleMoves, setSimpleMoves] = useState<string[]>([]);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const [engineColor] = useState<Color>("black");
  const humanColor: Color = engineColor === "white" ? "black" : "white";
  const isEngineTurnNow = sideToMove === engineColor;
  const isHumanTurnNow = sideToMove === humanColor;
  const [dragState, setDragState] = useState<{
    from: Square;
    piece: string;
    xPct: number;
    yPct: number;
  } | null>(null);

  const {
    ready: engineReady,
    bestMove: engineBestMove,
    evaluation: engineEvaluation,
    setFen: engineSetFen,
    goDepth: engineGoDepth,
  } = useStockfishEngine();

  const positionFen = useMemo(
    () => buildFenFromPosition(board, sideToMove, castling, enPassantTarget),
    [board, sideToMove, castling, enPassantTarget]
  );

  // Reset when FEN prop changes
  useEffect(() => {
    const next = parseInitialState(fen);
    setBoard(next.board);
    setSideToMove(next.sideToMove);
    setCastling(next.castling);
    setEnPassantTarget(next.enPassant);
    setSelectedSquare(null);
    setLegalMoves([]);
    setLastMove(null);
    setUciMoves([]);
    setSimpleMoves([]); // NEW
  }, [fen]);

  // Single engine search per position:
  // - engine to move => mode "play" (we will use bestMove)
  // - human to move  => mode "eval" (only eval bar)
  useEffect(() => {
    if (!engineReady) return;
    engineSetFen(positionFen);
    if (isEngineTurnNow) {
      engineGoDepth(1, "play");
    } else {
      engineGoDepth(1, "eval");
    }
  }, [engineReady, positionFen, isEngineTurnNow, engineSetFen, engineGoDepth]);

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

    const enemy: Color = sideToMove === "white" ? "black" : "white";

    return pseudo.filter((m) => {
      if (m.castling) {
        const row = sq.row;
        const cols = m.castling === "king" ? [4, 5, 6] : [4, 3, 2];
        for (const col of cols) {
          if (squareAttackedBy(board, { row, col }, enemy)) {
            return false;
          }
        }
      }
      const nb = makeMove(board, m);
      return !kingInCheck(nb, sideToMove);
    });
  };

  const startDragFromPiece = (
    e: React.MouseEvent<HTMLDivElement>,
    p: Piece
  ) => {
    e.preventDefault();
    e.stopPropagation();
    if (!boardRef.current) return;
    if (!isHumanTurnNow) return;
    if (pieceColor(p.type) !== humanColor) return;

    const rect = boardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const xPct = (x / rect.width) * 100;
    const yPct = (y / rect.height) * 100;

    const from: Square = { row: p.row, col: p.col };

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
      setSelectedSquare(null);
      setLegalMoves([]);
      return;
    }

    handleLeftClick(sq);
  };

  const handleLeftClick = (sq: Square) => {
    if (!isHumanTurnNow) return;

    const { row, col } = sq;
    const piece = board[row][col];

    if (piece && pieceColor(piece) === humanColor) {
      setSelectedSquare(sq);
      setLegalMoves(generateLegalMovesForSquare(sq));
      return;
    }

    if (selectedSquare) {
      const move = legalMoves.find((m) => m.to.row === row && m.to.col === col);
      if (!move) {
        setSelectedSquare(null);
        setLegalMoves([]);
        return;
      }

      const movingPiece = board[move.from.row][move.from.col];
      const newBoard = makeMove(board, move);
      setLastMove(move);

      // record notations using board BEFORE the move
      setUciMoves((prev) => [...prev, moveToUci(move)]);
      setSimpleMoves((prev) => [...prev, moveToSimpleNotation(move, board)]);

      let nextEnPassant: Square | null = null;
      if (move.enPassant) {
        nextEnPassant = null;
      } else if (move.doublePawn) {
        const epRow = (move.from.row + move.to.row) / 2;
        nextEnPassant = { row: epRow, col: move.to.col };
      }

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

      if (move.castling) {
        if (sideToMove === "white") {
          nextCastling.K = false;
          nextCastling.Q = false;
        } else {
          nextCastling.k = false;
          nextCastling.q = false;
        }
      }

      const newSideToMove: Color = sideToMove === "white" ? "black" : "white";

      setCastling(nextCastling);
      setEnPassantTarget(nextEnPassant);
      setBoard(newBoard);
      setSideToMove(newSideToMove);
      setSelectedSquare(null);
      setLegalMoves([]);
    }
  };

  const handleBoardClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (dragState) return;
    if (!isHumanTurnNow) return;
    const sq = getSquareFromEvent(e);
    if (!sq) return;
    if (e.button === 0) {
      handleLeftClick(sq);
    }
  };

  const enemySide: Color = sideToMove === "white" ? "black" : "white";
  const kingSquare = findKing(board, sideToMove);
  const kingIsInCheck =
    kingSquare !== null
      ? squareAttackedBy(board, kingSquare, enemySide)
      : false;

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

  const attackedTargets =
    selectedSquare && legalMoves.length > 0
      ? legalMoves
          .filter((m) => {
            const target = board[m.to.row][m.to.col];
            return target && pieceColor(target) !== sideToMove;
          })
          .map((m) => m.to)
      : [];

  const getSquareFromTouchEvent = (e: React.TouchEvent): Square | null => {
    if (!boardRef.current) return null;
    const touch = e.changedTouches[0];
    if (!touch) return null;

    const rect = boardRef.current.getBoundingClientRect();
    const size = rect.width / 8;
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    const col = Math.floor(x / size);
    const row = Math.floor(y / size);
    if (!inBounds(row, col)) return null;
    return { row, col };
  };

  const startDragFromPieceTouch = (
    e: React.TouchEvent<HTMLDivElement>,
    p: Piece
  ) => {
    e.preventDefault();
    e.stopPropagation();
    if (!boardRef.current) return;
    if (!isHumanTurnNow) return;
    if (pieceColor(p.type) !== humanColor) return;

    const touch = e.touches[0];
    if (!touch) return;

    const rect = boardRef.current.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    const xPct = (x / rect.width) * 100;
    const yPct = (y / rect.height) * 100;

    const from: Square = { row: p.row, col: p.col };

    setSelectedSquare(from);
    setLegalMoves(generateLegalMovesForSquare(from));

    setDragState({
      from,
      piece: p.type,
      xPct,
      yPct,
    });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!dragState || !boardRef.current) return;

    e.preventDefault();
    e.stopPropagation();

    const touch = e.touches[0];
    if (!touch) return;

    const rect = boardRef.current.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    const xPct = (x / rect.width) * 100;
    const yPct = (y / rect.height) * 100;

    setDragState((prev) => (prev ? { ...prev, xPct, yPct } : prev));
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const sq = getSquareFromTouchEvent(e);

    if (!dragState) {
      if (!sq) return;
      handleLeftClick(sq);
      return;
    }

    setDragState(null);

    if (!sq) {
      setSelectedSquare(null);
      setLegalMoves([]);
      return;
    }

    handleLeftClick(sq);
  };

  // Engine move
  useEffect(() => {
    if (!engineBestMove) return;
    if (!isEngineTurnNow) return;

    const move = parseUciMove(engineBestMove, board, castling, enPassantTarget);
    if (!move) return;

    const movingPiece = board[move.from.row][move.from.col];
    if (!movingPiece) return;

    const newBoard = makeMove(board, move);
    setLastMove(move);

    // record notations using board BEFORE the move
    setUciMoves((prev) => [...prev, moveToUci(move)]);
    setSimpleMoves((prev) => [...prev, moveToSimpleNotation(move, board)]);

    let nextEnPassant: Square | null = null;
    if (move.enPassant) {
      nextEnPassant = null;
    } else if (move.doublePawn) {
      const epRow = (move.from.row + move.to.row) / 2;
      nextEnPassant = { row: epRow, col: move.to.col };
    }

    let nextCastling: CastlingRights = { ...castling };

    if (movingPiece === "K") {
      nextCastling.K = false;
      nextCastling.Q = false;
    } else if (movingPiece === "k") {
      nextCastling.k = false;
      nextCastling.q = false;
    } else if (movingPiece === "R") {
      if (move.from.row === 7 && move.from.col === 0) nextCastling.Q = false;
      if (move.from.row === 7 && move.from.col === 7) nextCastling.K = false;
    } else if (movingPiece === "r") {
      if (move.from.row === 0 && move.from.col === 0) nextCastling.q = false;
      if (move.from.row === 0 && move.from.col === 7) nextCastling.k = false;
    }

    if (move.castling) {
      if (sideToMove === "white") {
        nextCastling.K = false;
        nextCastling.Q = false;
      } else {
        nextCastling.k = false;
        nextCastling.q = false;
      }
    }

    const nextSide: Color = sideToMove === "white" ? "black" : "white";

    setBoard(newBoard);
    setCastling(nextCastling);
    setEnPassantTarget(nextEnPassant);
    setSideToMove(nextSide);
    setSelectedSquare(null);
    setLegalMoves([]);
  }, [
    engineBestMove,
    isEngineTurnNow,
    board,
    castling,
    enPassantTarget,
    sideToMove,
  ]);

  const notationRows = (() => {
    const rows: { moveNumber: number; white?: string; black?: string }[] = [];
    for (let i = 0; i < simpleMoves.length; i += 2) {
      rows.push({
        moveNumber: i / 2 + 1,
        white: simpleMoves[i],
        black: simpleMoves[i + 1],
      });
    }
    return rows;
  })();

  return (
    <div
      className="w-full flex flex-col items-center"
      style={{
        // board: min(70vw,70vh,640px) + eval bar + gap + side padding
        width: "calc(min(70vw, 70vh, 640px) + 50px)",
        maxWidth: "100%",
      }}
    >
      {/* Move List*/}
      <MoveList notationList={notationRows} />

      {/* BOARD + EVAL BAR */}
      <div className="w-full flex justify-center gap-2 max-w-5xl p-2 bg-gray-600">
        {/* Eval bar */}
        <div className="flex flex-col justify-center">
          <div className="h-full">
            <EvalBar evaluation={engineEvaluation} sideToMove={sideToMove} />
          </div>
        </div>

        {/* Board */}
        <div
          ref={boardRef}
          className="relative aspect-square bg-chessboard select-none touch-none overscroll-none flex-[0_0_auto]"
          style={{
            width: "min(70vw, 70vh, 640px)",
          }}
          onClick={handleBoardClick}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onContextMenu={(e) => e.preventDefault()}
        >
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox="0 0 8 8"
          >
            <g>
              {lastMove && (
                <>
                  <rect
                    x={lastMove.from.col}
                    y={lastMove.from.row}
                    width={1}
                    height={1}
                    fill="rgba(0, 0, 255, 0.2)"
                  />
                  <rect
                    x={lastMove.to.col}
                    y={lastMove.to.row}
                    width={1}
                    height={1}
                    fill="rgba(0, 0, 255, 0.35)"
                  />
                </>
              )}
            </g>

            <g>
              {kingSquare && kingIsInCheck && (
                <rect
                  x={kingSquare.col}
                  y={kingSquare.row}
                  width={1}
                  height={1}
                  fill="rgba(255, 0, 0, 0.45)"
                />
              )}
            </g>

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
                <rect
                  key={i}
                  x={m.to.col}
                  y={m.to.row}
                  width={1}
                  height={1}
                  className="fill-yellow-300/90"
                />
              ))}

              {attackedTargets.map((sq, i) => (
                <rect
                  key={`capture-${i}`}
                  x={sq.col}
                  y={sq.row}
                  width={1}
                  height={1}
                  fill="rgba(255, 0, 0, 0.45)"
                />
              ))}

              {attackedSquares.map((sq, i) => (
                <rect
                  key={`attacked-${i}`}
                  x={sq.col}
                  y={sq.row}
                  width={1}
                  height={1}
                  fill="rgba(255, 215, 0, 0.35)"
                />
              ))}
            </g>

            <g>
              {files.map((f, col) => (
                <text
                  key={`file-${f}`}
                  x={col + 0.8}
                  y={7.8}
                  textAnchor="start"
                  dominantBaseline="hanging"
                  fontSize={0.2}
                  fill="black"
                >
                  {f}
                </text>
              ))}
            </g>

            <g>
              {ranks.map((r, i) => {
                const rowFromTop = 7 - i;
                return (
                  <text
                    key={`rank-${r}`}
                    x={0.2}
                    y={rowFromTop + 0.1}
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

          {squaresFromBoard.map((p) => {
            const isDragging =
              dragState &&
              dragState.from.row === p.row &&
              dragState.from.col === p.col;

            const canDragThisPiece =
              isHumanTurnNow && pieceColor(p.type) === humanColor;

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
                onMouseDown={
                  canDragThisPiece ? (e) => startDragFromPiece(e, p) : undefined
                }
                onTouchStart={
                  canDragThisPiece
                    ? (e) => startDragFromPieceTouch(e, p)
                    : undefined
                }
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
