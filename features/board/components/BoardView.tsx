"use client";

import React, { useMemo } from "react";
import { Chessboard } from "react-chessboard";
import type { SquareHandlerArgs } from "react-chessboard";
import type {
  CoordinatesPlacement,
  Orientation,
  OptionSquares,
} from "../types";
import { boardTheme } from "../lib/board-theme";

type BoardViewProps = {
  chessPosition: string;
  orientation: Orientation;
  optionSquares: OptionSquares;
  onSquareClick: (args: SquareHandlerArgs) => void;
  showCoordinates: boolean;
  coordinatesPlacement: CoordinatesPlacement;
};

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"];

export function BoardView({
  chessPosition,
  orientation,
  optionSquares,
  onSquareClick,
  showCoordinates,
  coordinatesPlacement,
}: BoardViewProps) {
  const showOutsideCoordinates =
    showCoordinates && coordinatesPlacement === "outside";

  const chessboardOptions = useMemo(
    () => ({
      id: "play-vs-stockfish",
      position: chessPosition,
      onSquareClick,
      boardOrientation: orientation,
      squareStyles: optionSquares,
      allowDragging: false,
      allowDragOffBoard: false,
      showNotation: showCoordinates && coordinatesPlacement === "inside",
      darkSquareStyle: boardTheme.darkSquareStyle,
      lightSquareStyle: boardTheme.lightSquareStyle,
      boardStyle: boardTheme.boardStyle,
    }),
    [
      chessPosition,
      onSquareClick,
      optionSquares,
      orientation,
      showCoordinates,
      coordinatesPlacement,
    ],
  );

  if (!showOutsideCoordinates) {
    return (
      <div className="h-(--board-size) w-(--board-size) shrink-0 rounded">
        <Chessboard options={chessboardOptions} />
      </div>
    );
  }

  const files = orientation === "white" ? FILES : [...FILES].reverse();
  const ranks = orientation === "white" ? RANKS : [...RANKS].reverse();

  return (
    <div className="flex h-(--board-size) w-(--board-size) shrink-0 [--coord-size:1.5rem]">
      <div className="flex w-(--coord-size) flex-col font-mono text-xs text-neutral-500">
        {ranks.map((rank) => (
          <span key={rank} className="flex flex-1 items-center justify-center">
            {rank}
          </span>
        ))}
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 rounded">
          <Chessboard options={chessboardOptions} />
        </div>

        <div className="flex h-(--coord-size) font-mono text-xs text-neutral-500">
          {files.map((file) => (
            <span key={file} className="flex flex-1 items-center justify-center">
              {file}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
