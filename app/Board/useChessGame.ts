"use client";

import { Chess, Move, Square } from "chess.js";
import { useCallback, useMemo, useState } from "react";

export type Orientation = "white" | "black";

export function useChessGame(
  initialFen: string,
  initialOrientation: Orientation = "white"
) {
  const [fen, setFen] = useState(initialFen);
  const [orientation, setOrientation] = useState(initialOrientation);

  const game = useMemo(() => {
    const g = new Chess();
    g.load(fen);
    return g;
  }, [fen]);

  const makeMove = useCallback((move: string | Move) => {
    setFen((prevFen) => {
      const g = new Chess();
      g.load(prevFen);
      const result = g.move(move);
      if (!result) return prevFen;
      return g.fen();
    });
  }, []);

  const reset = useCallback(() => {
    const g = new Chess();
    setFen(g.fen());
    setOrientation("white");
  }, []);

  const flipOrientation = useCallback(() => {
    setOrientation((o) => (o === "white" ? "black" : "white"));
  }, []);

  const legalMovesFrom = useCallback(
    (square: Square) => {
      return game.moves({ square, verbose: true }) as Move[];
    },
    [game]
  );

  return {
    game,
    fen,
    orientation,
    setOrientation,
    flipOrientation,
    makeMove,
    reset,
    legalMovesFrom,
  };
}
