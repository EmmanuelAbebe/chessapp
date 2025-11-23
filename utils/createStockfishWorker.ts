// utils/createStockfishWorker.ts

export function createStockfishWorker(): Worker | null {
  if (typeof window === "undefined") return null;

  // File lives at public/stockfish/stockfish.js
  // Served at /stockfish/stockfish.js at runtime.
  return new Worker("/stockfish/stockfish.js");
}
