"use client";

import React, { useMemo } from "react";
import { Chessboard } from "react-chessboard";
import type { SquareHandlerArgs } from "react-chessboard";
import type { Orientation, OptionSquares } from "../types";
import { boardTheme } from "../lib/board-theme";

type BoardViewProps = {
  chessPosition: string;
  orientation: Orientation;
  optionSquares: OptionSquares;
  onSquareClick: (args: SquareHandlerArgs) => void;
};

export function BoardView({
  chessPosition,
  orientation,
  optionSquares,
  onSquareClick,
}: BoardViewProps) {
  const chessboardOptions = useMemo(
    () => ({
      id: "play-vs-stockfish",
      position: chessPosition,
      onSquareClick,
      boardOrientation: orientation,
      squareStyles: optionSquares,
      allowDragging: false,
      allowDragOffBoard: false,
      darkSquareStyle: boardTheme.darkSquareStyle,
      lightSquareStyle: boardTheme.lightSquareStyle,
      boardStyle: boardTheme.boardStyle,
    }),
    [chessPosition, onSquareClick, optionSquares, orientation],
  );

  return (
    <div className="rounded w-150 h-150">
      <Chessboard options={chessboardOptions} />
    </div>
  );
}
