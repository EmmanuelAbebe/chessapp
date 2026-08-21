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
  aiArrows?: Arrow[];
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
  aiArrows = [],
}: BoardViewProps) {
  const [highlightedSquares, setHighlightedSquares] = useState<Set<string>>(
    new Set(),
  );
  const [userArrows, setUserArrows] = useState<Arrow[]>([]);

  // Right-click highlights point at a specific position - clear them
  // whenever the position changes rather than let them go stale. User-drawn
  // arrows don't need this: react-chessboard clears its own internally-
  // managed arrows on position change by default.
  useEffect(() => {
    setHighlightedSquares(new Set());
  }, [chessPosition]);

  const highlightStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};
    for (const square of highlightedSquares) {
      styles[square] = HIGHLIGHT_STYLE;
    }
    return styles;
  }, [highlightedSquares]);

  // react-chessboard renders [...arrows, ...internallyDrawnArrows] together,
  // keyed only by start/end square - so an AI arrow that lands on the same
  // squares as a user-drawn one (or a duplicate within aiArrows itself, e.g.
  // two MultiPV lines briefly agreeing on the same first move) produces a
  // duplicate React key. Drop any AI arrow that collides with either.
  const dedupedAiArrows = useMemo(() => {
    const arrowKey = (arrow: Arrow) => `${arrow.startSquare}-${arrow.endSquare}`;
    const userKeys = new Set(userArrows.map(arrowKey));
    const seen = new Set<string>();
    const result: Arrow[] = [];

    for (const arrow of aiArrows) {
      const key = arrowKey(arrow);
      if (seen.has(key) || userKeys.has(key)) continue;
      seen.add(key);
      result.push(arrow);
    }

    return result;
  }, [aiArrows, userArrows]);

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
      arrows: dedupedAiArrows,
      // Observe what the user has drawn (purely read-only - never fed back
      // into the arrows prop) so dedupedAiArrows can avoid colliding with it.
      onArrowsChange: ({ arrows: nextUserArrows }: { arrows: Arrow[] }) =>
        setUserArrows(nextUserArrows),
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
      dedupedAiArrows,
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
      <div className="flex w-(--coord-size) flex-col font-mono text-xs text-text-faint">
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

        <div className="flex h-(--coord-size) font-mono text-xs text-text-faint">
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
