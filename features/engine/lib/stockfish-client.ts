import type { EngineLineHandler, StockfishEngine } from "../types";

export function createEngine(): StockfishEngine {
  const worker = new Worker("/stockfish/stockfish-18.js");

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
