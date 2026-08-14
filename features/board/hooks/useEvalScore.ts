"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import { createEngine } from "@/features/engine/lib/stockfish-client";
import type { StockfishEngine } from "@/features/engine/types";
import { scoreToWhite, whitePercentFromScore } from "../lib/eval-format";

type EvalState = {
  cp: number | null;
  mate: number | null;
  bestMove: string | null;
  depth: number;
};

type MotionState = {
  position: number;
  velocity: number;
};

function stepEvalMotion(
  state: MotionState,
  target: number,
  dt: number,
): MotionState {
  let { position, velocity } = state;

  const distance = target - position;
  const acceleration = 22;
  const drag = 0.82;
  const epsilon = 0.35;

  velocity += distance * acceleration * dt;
  velocity *= Math.pow(drag, dt * 60);
  position += velocity * dt;

  if (Math.abs(target - position) < epsilon && Math.abs(velocity) < epsilon) {
    position = target;
    velocity = 0;
  }

  return { position, velocity };
}

export function useEvalScore(fen: string, depth = 12, enabled = true) {
  const engineRef = useRef<StockfishEngine | null>(null);
  const requestIdRef = useRef(0);
  const animationFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const motionRef = useRef<MotionState>({
    position: 0,
    velocity: 0,
  });
  const targetScoreRef = useRef(0);

  const [evalState, setEvalState] = useState<EvalState>({
    cp: null,
    mate: null,
    bestMove: null,
    depth: 0,
  });
  const [displayScore, setDisplayScore] = useState(0);
  const [displayMate, setDisplayMate] = useState<number | null>(null);

  const chess = useMemo(() => new Chess(fen), [fen]);
  const turn = chess.turn();

  useEffect(() => {
    const animate = (time: number) => {
      const last = lastTimeRef.current ?? time;
      const dt = Math.min((time - last) / 1000, 1 / 30);
      lastTimeRef.current = time;

      motionRef.current = stepEvalMotion(
        motionRef.current,
        targetScoreRef.current,
        dt,
      );

      setDisplayScore(motionRef.current.position);
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

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

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    if (!enabled) return;

    const engine = engineRef.current;
    if (!engine) return;

    const requestId = ++requestIdRef.current;
    const minDepth = 8;

    setEvalState({
      cp: null,
      mate: null,
      bestMove: null,
      depth: 0,
    });
    setDisplayMate(null);

    engine.onLine((line) => {
      if (requestId !== requestIdRef.current) return;

      if (line.startsWith("info")) {
        const depthMatch = line.match(/\bdepth\s+(\d+)/);
        const cpMatch = line.match(/\bscore\s+cp\s+(-?\d+)/);
        const mateMatch = line.match(/\bscore\s+mate\s+(-?\d+)/);
        const pvMatch = line.match(/\bpv\s+(\S+)/);

        const parsedDepth = depthMatch ? Number(depthMatch[1]) : 0;
        if (parsedDepth < minDepth) return;

        const nextCp = cpMatch ? Number(cpMatch[1]) : null;
        const nextMate = mateMatch ? Number(mateMatch[1]) : null;

        if (nextCp === null && nextMate === null) return;

        setEvalState((current) => {
          if (parsedDepth < current.depth) return current;

          return {
            cp: nextCp,
            mate: nextMate,
            depth: parsedDepth,
            bestMove: pvMatch?.[1] ?? current.bestMove,
          };
        });

        const whiteScore = scoreToWhite(nextCp, nextMate, turn);
        targetScoreRef.current = whiteScore;
        setDisplayMate(nextMate);
      }
    });

    engine.postMessage("stop");
    engine.postMessage(`position fen ${fen}`);
    engine.postMessage(`go depth ${depth}`);
  }, [fen, depth, turn, enabled]);

  return {
    displayScore,
    displayMate,
    whitePercent: whitePercentFromScore(displayScore),
    depth: evalState.depth,
    bestMove: evalState.bestMove,
  };
}
