declare module "stockfish.wasm" {
  // The library exports a factory returning an engine instance.
  // The engine behaves like a Web Worker.
  export default function createStockfish(): Promise<{
    postMessage: (msg: string) => void;
    addEventListener: (
      type: "message",
      callback: (ev: MessageEvent) => void
    ) => void;
    removeEventListener: (
      type: "message",
      callback: (ev: MessageEvent) => void
    ) => void;
    terminate?: () => void;
  }>;
}
