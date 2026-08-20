"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Chessboard } from "react-chessboard";
import type { Arrow, SquareHandlerArgs } from "react-chessboard";
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

const HIGHLIGHT_STYLE: React.CSSProperties = {
  backgroundColor: "rgba(34, 197, 94, 0.35)",
};

export function BoardView({
  chessPosition,
  orientation,
  optionSquares,
  onSquareClick,
  showCoordinates,
  coordinatesPlacement,
}: BoardViewProps) {
  const [arrows, setArrows] = useState<Arrow[]>([]);
  const [highlightedSquares, setHighlightedSquares] = useState<Set<string>>(
    new Set(),
  );

  // Right-click annotations point at a specific position - clear them
  // whenever the position changes rather than let them go stale.
  useEffect(() => {
    setArrows([]);
    setHighlightedSquares(new Set());
  }, [chessPosition]);

  const highlightStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};
    for (const square of highlightedSquares) {
      styles[square] = HIGHLIGHT_STYLE;
    }
    return styles;
  }, [highlightedSquares]);

  const showOutsideCoordinates =
    showCoordinates && coordinatesPlacement === "outside";

  const chessboardOptions = useMemo(
    () => ({
      id: "play-vs-stockfish",
      position: chessPosition,
      onSquareClick,
      onSquareRightClick: ({ square }: SquareHandlerArgs) => {
        setHighlightedSquares((prev) => {
          const next = new Set(prev);
          if (next.has(square)) {
            next.delete(square);
          } else {
            next.add(square);
          }
          return next;
        });
      },
      boardOrientation: orientation,
      squareStyles: { ...optionSquares, ...highlightStyles },
      allowDragging: false,
      allowDragOffBoard: false,
      allowDrawingArrows: true,
      arrows,
      onArrowsChange: ({ arrows: nextArrows }: { arrows: Arrow[] }) =>
        setArrows(nextArrows),
      showNotation: showCoordinates && coordinatesPlacement === "inside",
      darkSquareStyle: boardTheme.darkSquareStyle,
      lightSquareStyle: boardTheme.lightSquareStyle,
      boardStyle: boardTheme.boardStyle,
    }),
    [
      chessPosition,
      onSquareClick,
      optionSquares,
      highlightStyles,
      orientation,
      arrows,
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
