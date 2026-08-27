"use client";

import { useEffect, useRef, useState } from "react";
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
  // The fen an in-flight "go" was actually issued for, vs. whatever fen is
  // live right now - if the player navigates (undo, jump to a different
  // node, replay a branch) while the engine is still thinking, its eventual
  // bestmove belongs to a position that's no longer current. Applying it
  // anyway would either silently fail (illegal for the new position) or,
  // worse, land a legal-but-wrong move - this is what "the opponent just
  // stops responding" after undo actually was.
  const pendingFenRef = useRef<string | null>(null);
  const latestFenRef = useRef(fen);
  latestFenRef.current = fen;
  // `onLine` is only ever registered once, in the mount effect below - a
  // ref is what keeps it calling the *current* onMove (which closes over
  // the live tree/currentNodeId) instead of whatever onMove existed at
  // mount time, which would go on applying every reply to that original,
  // long-stale position forever.
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;

  // Whether a search is currently in flight - drives the "thinking" spinner
  // on the play-vs-Stockfish button, so it's only ever true between a `go`
  // going out and either its reply landing or the position moving on.
  const [isThinking, setIsThinking] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    const engine = createEngine();
    engineRef.current = engine;
    engine.postMessage("uci");
    engine.postMessage("isready");
    engine.onLine((line) => {
      const move = parseBestMove(line);
      if (!move) return;
      if (pendingFenRef.current !== latestFenRef.current) return;
      setIsThinking(false);
      onMoveRef.current(move);
    });

    return () => {
      engine.postMessage("stop");
      engine.terminate();
      engineRef.current = null;
      pendingFenRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  useEffect(() => {
    if (!enabled || turn === playerSide) {
      setIsThinking(false);
      return;
    }

    const engine = engineRef.current;
    if (!engine) return;

    // Abandon whatever position it was previously thinking about before
    // asking about this one, so a stale search doesn't keep running (the
    // fen check above is what actually guards against acting on it, but
    // there's no reason to let the engine keep burning time on it too).
    engine.postMessage("stop");
    pendingFenRef.current = fen;
    setIsThinking(true);
    engine.postMessage(`setoption name Skill Level value ${skillLevel}`);
    engine.postMessage(`position fen ${fen}`);
    engine.postMessage(`go movetime ${MOVE_TIME_MS}`);
  }, [enabled, fen, turn, playerSide, skillLevel]);

  return { isThinking };
}
