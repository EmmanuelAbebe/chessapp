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
      <div className="h-full w-full rounded">
        <Chessboard options={chessboardOptions} />
      </div>
    );
  }

  const files = orientation === "white" ? FILES : [...FILES].reverse();
  const ranks = orientation === "white" ? RANKS : [...RANKS].reverse();

  return (
    <div className="flex h-full w-full">
      <div className="flex flex-col pr-1 font-mono text-xs text-gray-500">
        {ranks.map((rank) => (
          <span key={rank} className="flex flex-1 items-center">
            {rank}
          </span>
        ))}
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 rounded">
          <Chessboard options={chessboardOptions} />
        </div>

        <div className="flex pt-1 font-mono text-xs text-gray-500">
          {files.map((file) => (
            <span key={file} className="flex-1 text-center">
              {file}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
