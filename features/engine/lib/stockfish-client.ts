import type { EngineLineHandler, StockfishEngine } from "../types";

export function createEngine(): StockfishEngine {
  // The lite single-threaded build (~7MB, no SharedArrayBuffer/COOP-COEP
  // requirement) rather than the full multi-threaded one (~108MB, needed
  // Git LFS just to fit in a repo and needs cross-origin isolation to run at
  // all) - the full build silently never worked once deployed: GitHub
  // rejects files that size without LFS, and hosts that don't fetch LFS
  // objects on clone (Vercel doesn't by default) serve back a tiny pointer
  // file in its place, which the browser can't instantiate as WASM.
  const worker = new Worker("/stockfish/stockfish-18-lite-single.js");

  let lineHandler: EngineLineHandler = () => {};

  worker.onmessage = (event: MessageEvent) => {
    const line = String(event.data ?? "");
    lineHandler(line);
  };

  return {
    postMessage: (msg: string) => worker.postMessage(msg),
    terminate: () => worker.terminate(),
    onLine: (handler: EngineLineHandler) => {
      lineHandler = handler;
    },
  };
}
