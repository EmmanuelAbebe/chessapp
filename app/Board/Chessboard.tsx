"use client";

import { useState } from "react";
import Board from "./Board";
import { parseFEN, startPosition } from "./FEN";

export default function ChessBoardUI() {
  const {
    board: initialBoard,
    activeColor,
    castling,
    enPassant,
  } = parseFEN(startPosition);

  const [board, setBoard] = useState(initialBoard);
  const [sideToMove, setSideToMove] = useState(activeColor);

  return <Board fen={startPosition} />;
}
