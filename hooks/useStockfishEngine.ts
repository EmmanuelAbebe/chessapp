// src/hooks/useStockfishEngine.ts
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
// import from the library:
import createStockfish from "stockfish.wasm";

type EngineInstance = {
  postMessage: (msg: string) => void;
  addEventListener: (
    type: "message",
    listener: (e: MessageEvent) => void
  ) => void;
  removeEventListener: (
    type: "message",
    listener: (e: MessageEvent) => void
  ) => void;
  terminate?: () => void; // some builds support this, not strictly required
};

interface EngineOpts {
  movetime?: number;
  depth?: number;
}

export function useStockfishEngine() {
  const engineRef = useRef<EngineInstance | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const pendingResolve = useRef<((uciMove: string | null) => void) | null>(
    null
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    let cancelled = false;

    const init = async () => {
      const engine = await createStockfish(); // <– main change
      if (cancelled) return;

      engineRef.current = engine;

      const handleMessage = (e: MessageEvent) => {
        const line = String(e.data);

        if (line === "uciok") {
          setReady(true);
        }

        if (line.startsWith("bestmove")) {
          setBusy(false);
          const parts = line.split(" ");
          const best = parts[1] && parts[1] !== "(none)" ? parts[1] : null;
          if (pendingResolve.current) {
            pendingResolve.current(best);
            pendingResolve.current = null;
          }
        }
      };

      engine.addEventListener("message", handleMessage);

      // Send initial UCI command
      engine.postMessage("uci");

      // Cleanup
      return () => {
        engine.removeEventListener("message", handleMessage);
        engineRef.current = null;
        pendingResolve.current = null;
        if (engine.terminate) engine.terminate();
      };
    };

    const cleanupPromise = init();

    return () => {
      cancelled = true;
      // if init resolved with a cleanup fn, it will be called by React anyway
    };
  }, []);

  const send = useCallback((cmd: string) => {
    if (!engineRef.current) return;
    engineRef.current.postMessage(cmd);
  }, []);

  const newGame = useCallback(() => {
    if (!engineRef.current) return;
    send("ucinewgame");
  }, [send]);

  const getBestMove = useCallback(
    (fen: string, opts: EngineOpts = {}): Promise<string | null> => {
      if (!engineRef.current || !ready || busy) {
        return Promise.resolve(null);
      }

      // cancel previous pending if any
      if (pendingResolve.current) {
        pendingResolve.current(null);
      }

      setBusy(true);
      const { movetime = 1000, depth } = opts;

      return new Promise<string | null>((resolve) => {
        pendingResolve.current = resolve;

        send(`position fen ${fen}`);

        if (depth !== undefined) {
          send(`go depth ${depth}`);
        } else {
          send(`go movetime ${movetime}`);
        }
      });
    },
    [ready, busy, send]
  );

  return {
    ready,
    busy,
    newGame,
    getBestMove,
  };
}
