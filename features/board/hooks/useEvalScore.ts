"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import { createEngine } from "@/features/engine/lib/stockfish-client";
import type { StockfishEngine } from "@/features/engine/types";
import { scoreToWhite, whitePercentFromScore } from "../lib/eval-format";

const MULTIPV_COUNT = 4;
const MIN_DEPTH = 4;

export type CandidateMove = {
  move: string;
  cp: number | null;
  mate: number | null;
  depth: number;
};

type EvalState = {
  cp: number | null;
  mate: number | null;
  bestMove: string | null;
  depth: number;
  candidates: (CandidateMove | undefined)[];
};

type ActiveSearch = {
  fen: string;
  isPonder: boolean;
};

type MotionState = {
  position: number;
  velocity: number;
};

function emptyEvalState(): EvalState {
  return { cp: null, mate: null, bestMove: null, depth: 0, candidates: [] };
}

function mergeEvalUpdate(
  current: EvalState,
  update: {
    multipvIndex: number;
    cp: number | null;
    mate: number | null;
    move: string;
    depth: number;
  },
): EvalState {
  const candidates = [...current.candidates];
  const slotIndex = update.multipvIndex - 1;

  if (slotIndex >= 0 && slotIndex < MULTIPV_COUNT) {
    const existing = candidates[slotIndex];
    if (!existing || update.depth >= existing.depth) {
      candidates[slotIndex] = {
        move: update.move,
        cp: update.cp,
        mate: update.mate,
        depth: update.depth,
      };
    }
  }

  if (update.multipvIndex !== 1 || update.depth < current.depth) {
    return { ...current, candidates };
  }

  return {
    cp: update.cp,
    mate: update.mate,
    depth: update.depth,
    bestMove: update.move,
    candidates,
  };
}

/** The position two plies from now if our top move and the engine's
 * predicted reply both happen - what we speculatively ponder while
 * waiting for the actual move. */
function computePonderFen(
  fen: string,
  bestMoveUci: string,
  replyUci: string,
): string | null {
  try {
    const chess = new Chess(fen);

    const best = chess.move({
      from: bestMoveUci.slice(0, 2),
      to: bestMoveUci.slice(2, 4),
      promotion: bestMoveUci.slice(4) || undefined,
    });
    if (!best) return null;

    const reply = chess.move({
      from: replyUci.slice(0, 2),
      to: replyUci.slice(2, 4),
      promotion: replyUci.slice(4) || undefined,
    });
    if (!reply) return null;

    return chess.fen();
  } catch {
    return null;
  }
}

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
  const animationFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const motionRef = useRef<MotionState>({ position: 0, velocity: 0 });
  const targetScoreRef = useRef(0);

  // Bookkeeping for pondering - refs, not state, since they're read inside
  // the engine's onLine handler (registered once per engine instance) and
  // must always reflect the latest values, not whatever was captured when
  // the handler was created.
  const realFenRef = useRef(fen);
  const realTurnRef = useRef<"w" | "b">("w");
  const targetDepthRef = useRef(depth);
  const activeSearchRef = useRef<ActiveSearch | null>(null);
  const pendingSearchRef = useRef<ActiveSearch | null>(null);
  const ponderStateRef = useRef<{ fen: string; state: EvalState } | null>(
    null,
  );

  const [evalState, setEvalState] = useState<EvalState>(emptyEvalState());
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

  // Engine lifecycle. The onLine handler is registered once here (not per
  // fen change) so a ponder search can keep streaming updates across a
  // "hit" without ever being torn down and restarted.
  useEffect(() => {
    if (!enabled) return;

    const engine = createEngine();
    engineRef.current = engine;

    activeSearchRef.current = null;
    pendingSearchRef.current = null;
    ponderStateRef.current = null;

    engine.postMessage("uci");
    engine.postMessage("isready");
    engine.postMessage(`setoption name MultiPV value ${MULTIPV_COUNT}`);

    engine.onLine((line) => {
      if (line.startsWith("bestmove")) {
        const pending = pendingSearchRef.current;
        pendingSearchRef.current = null;

        if (pending) {
          activeSearchRef.current = pending;
          engine.postMessage(`position fen ${pending.fen}`);
          engine.postMessage(`go depth ${targetDepthRef.current}`);
        } else {
          activeSearchRef.current = null;
        }
        return;
      }

      if (!line.startsWith("info")) return;

      const depthMatch = line.match(/\bdepth\s+(\d+)/);
      const multipvMatch = line.match(/\bmultipv\s+(\d+)/);
      const cpMatch = line.match(/\bscore\s+cp\s+(-?\d+)/);
      const mateMatch = line.match(/\bscore\s+mate\s+(-?\d+)/);
      const pvMatch = line.match(/\bpv\s+(\S+)(?:\s+(\S+))?/);

      const parsedDepth = depthMatch ? Number(depthMatch[1]) : 0;
      if (parsedDepth < MIN_DEPTH) return;

      const multipvIndex = multipvMatch ? Number(multipvMatch[1]) : 1;
      const nextCp = cpMatch ? Number(cpMatch[1]) : null;
      const nextMate = mateMatch ? Number(mateMatch[1]) : null;
      const nextMove = pvMatch?.[1] ?? null;
      const nextReply = pvMatch?.[2] ?? null;

      if ((nextCp === null && nextMate === null) || !nextMove) return;

      const active = activeSearchRef.current;
      if (!active) return;

      const update = {
        multipvIndex,
        cp: nextCp,
        mate: nextMate,
        move: nextMove,
        depth: parsedDepth,
      };

      if (!active.isPonder && active.fen === realFenRef.current) {
        setEvalState((current) => mergeEvalUpdate(current, update));

        if (multipvIndex === 1) {
          targetScoreRef.current = scoreToWhite(
            nextCp,
            nextMate,
            realTurnRef.current,
          );
          setDisplayMate(nextMate);

          const reachedTargetDepth = parsedDepth >= targetDepthRef.current;
          if (
            reachedTargetDepth &&
            nextReply &&
            !ponderStateRef.current &&
            !pendingSearchRef.current
          ) {
            const ponderFen = computePonderFen(
              realFenRef.current,
              nextMove,
              nextReply,
            );
            if (ponderFen) {
              ponderStateRef.current = { fen: ponderFen, state: emptyEvalState() };
              pendingSearchRef.current = { fen: ponderFen, isPonder: true };
              engine.postMessage("stop");
            }
          }
        }
      } else if (
        active.isPonder &&
        ponderStateRef.current &&
        active.fen === ponderStateRef.current.fen
      ) {
        ponderStateRef.current = {
          fen: ponderStateRef.current.fen,
          state: mergeEvalUpdate(ponderStateRef.current.state, update),
        };
      }
    });

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

    targetDepthRef.current = depth;
    realFenRef.current = fen;
    realTurnRef.current = turn;

    const ponder = ponderStateRef.current;

    if (ponder && ponder.fen === fen) {
      // Ponder hit: we already predicted this exact position. Adopt
      // whatever it has (even mid-search results beat nothing), and if
      // the search is still running, relabel it as the real search
      // instead of stopping/restarting.
      setEvalState(ponder.state);
      targetScoreRef.current = scoreToWhite(
        ponder.state.cp,
        ponder.state.mate,
        turn,
      );
      setDisplayMate(ponder.state.mate);
      ponderStateRef.current = null;

      const active = activeSearchRef.current;
      if (active && active.isPonder && active.fen === fen) {
        activeSearchRef.current = { fen, isPonder: false };
      } else {
        activeSearchRef.current = null;
      }
      return;
    }

    // Ponder miss (or nothing was being pondered): the move that happened
    // wasn't the one we expected, so any arrows/eval on screen point at a
    // position that no longer exists. Clear immediately rather than let
    // them linger while the fresh search gets going.
    setEvalState(emptyEvalState());
    setDisplayMate(null);
    ponderStateRef.current = null;

    if (activeSearchRef.current) {
      pendingSearchRef.current = { fen, isPonder: false };
      engine.postMessage("stop");
    } else {
      activeSearchRef.current = { fen, isPonder: false };
      engine.postMessage(`position fen ${fen}`);
      engine.postMessage(`go depth ${depth}`);
    }
  }, [fen, depth, turn, enabled]);

  return {
    displayScore,
    displayMate,
    whitePercent: whitePercentFromScore(displayScore),
    depth: evalState.depth,
    bestMove: evalState.bestMove,
    candidates: evalState.candidates,
  };
}
