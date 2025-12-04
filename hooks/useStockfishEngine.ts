// hooks/useStockfishEngine.ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createStockfishWorker } from "../utils/createStockfishWorker";

type EngineLine = string;

export type EngineEval =
  | { type: "cp"; value: number } // centipawns, side-to-move POV
  | { type: "mate"; value: number }; // mate in N, side-to-move POV

type EngineMode = "idle" | "eval" | "play";

export function useStockfishEngine() {
  const engineRef = useRef<Worker | null>(null);
  const [ready, setReady] = useState(false);
  const [bestMove, setBestMove] = useState<string | null>(null);
  const [lastLine, setLastLine] = useState<string | null>(null);
  const [evaluation, setEvaluation] = useState<EngineEval | null>(null);

  const modeRef = useRef<EngineMode>("idle");

  useEffect(() => {
    const worker = createStockfishWorker();
    if (!worker) return;

    engineRef.current = worker;

    worker.onmessage = (event: MessageEvent<EngineLine>) => {
      const line = event.data;
      setLastLine(line);

      if (line === "uciok") {
        setReady(true);
        return;
      }

      if (line.startsWith("info ") && line.includes(" score ")) {
        const tokens = line.split(/\s+/);
        const idx = tokens.indexOf("score");
        if (idx !== -1 && idx + 2 < tokens.length) {
          const t = tokens[idx + 1]; // cp | mate
          const vStr = tokens[idx + 2];
          const v = Number(vStr);
          if (!Number.isNaN(v)) {
            if (t === "cp") {
              setEvaluation({ type: "cp", value: v });
            } else if (t === "mate") {
              setEvaluation({ type: "mate", value: v });
            }
          }
        }
      }

      if (line.startsWith("bestmove")) {
        // Only treat this as a move when we requested a "play" search
        if (modeRef.current === "play") {
          const parts = line.split(/\s+/);
          const bm = parts[1];
          if (bm && bm !== "(none)") {
            setBestMove(bm);
          }
        }
        modeRef.current = "idle";
      }
    };

    worker.postMessage("uci");

    return () => {
      worker.postMessage("quit");
      worker.terminate();
      engineRef.current = null;
    };
  }, []);

  const send = useCallback((cmd: string) => {
    if (!engineRef.current) return;
    engineRef.current.postMessage(cmd);
  }, []);

  const setFen = useCallback(
    (fen: string) => {
      if (!engineRef.current) return;
      send(`position fen ${fen}`);
    },
    [send]
  );

  const goDepth = useCallback(
    (depth: number, mode: EngineMode = "eval") => {
      if (!engineRef.current) return;
      modeRef.current = mode;
      if (mode === "play") {
        setBestMove(null);
      }
      send(`go depth ${depth}`);
    },
    [send]
  );

  return {
    ready,
    bestMove,
    lastLine,
    evaluation,
    setFen,
    goDepth, // now takes (depth, mode)
    send,
  };
}
