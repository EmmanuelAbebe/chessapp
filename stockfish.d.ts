// stockfish.d.ts  (at project root)

interface StockfishWorker extends Worker {
  postMessage(message: string): void;
  onmessage: ((this: Worker, ev: MessageEvent<string>) => any) | null;
}

declare function createStockfishWorker(): StockfishWorker | null;
