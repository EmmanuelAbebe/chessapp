// hooks/useStockfishEngine.ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createStockfishWorker } from "../utils/createStockfishWorker";

type EngineLine = string;

export function useStockfishEngine() {
  const engineRef = useRef<Worker | null>(null);
  const [ready, setReady] = useState(false);
  const [bestMove, setBestMove] = useState<string | null>(null);
  const [lastLine, setLastLine] = useState<string | null>(null);

  useEffect(() => {
    const worker = createStockfishWorker();
    if (!worker) return;

    engineRef.current = worker;

    worker.onmessage = (event: MessageEvent<EngineLine>) => {
      const line = event.data;
      setLastLine(line);

      if (line === "uciok") {
        setReady(true);
      }

      if (line.startsWith("bestmove")) {
        const parts = line.split(" ");
        if (parts.length >= 2) {
          setBestMove(parts[1]);
        }
      }

      // If you want eval/depth, parse lines starting with "info".
    };

    // Initialize in UCI mode
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
    (depth: number) => {
      if (!engineRef.current) return;
      setBestMove(null);
      send(`go depth ${depth}`);
    },
    [send]
  );

  return {
    ready,
    bestMove,
    lastLine,
    setFen,
    goDepth,
    send,
  };
}
