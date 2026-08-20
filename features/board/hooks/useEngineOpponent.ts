"use client";

import { useEffect, useRef } from "react";
import { createEngine } from "@/features/engine/lib/stockfish-client";
import type { StockfishEngine } from "@/features/engine/types";
import { parseBestMove } from "@/features/engine/lib/stockfish-parser";

const MOVE_TIME_MS = 700;

type UseEngineOpponentArgs = {
  enabled: boolean;
  fen: string;
  turn: "w" | "b";
  playerSide: "w" | "b";
  skillLevel: number;
  onMove: (uciMove: string) => void;
};

/** Runs a separate Stockfish instance (independent of the analysis engine in
 * useEvalScore) that automatically plays the non-player side once it's
 * their turn. */
export function useEngineOpponent({
  enabled,
  fen,
  turn,
  playerSide,
  skillLevel,
  onMove,
}: UseEngineOpponentArgs) {
  const engineRef = useRef<StockfishEngine | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const engine = createEngine();
    engineRef.current = engine;
    engine.postMessage("uci");
    engine.postMessage("isready");

    return () => {
      engine.postMessage("stop");
      engine.terminate();
      engineRef.current = null;
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    if (turn === playerSide) return;

    const engine = engineRef.current;
    if (!engine) return;

    engine.onLine((line) => {
      const move = parseBestMove(line);
      if (move) onMove(move);
    });

    engine.postMessage(`setoption name Skill Level value ${skillLevel}`);
    engine.postMessage(`position fen ${fen}`);
    engine.postMessage(`go movetime ${MOVE_TIME_MS}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, fen, turn, playerSide, skillLevel]);
}
