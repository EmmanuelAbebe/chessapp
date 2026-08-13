// export type EngineLineHandler = (line: string) => void;

// export type ParsedEngineInfo = {
//   depth: number;
//   cp: number | null;
//   mate: number | null;
//   bestMoveFromPv: string | null;
// };

// export type StartAnalysisArgs = {
//   fen: string;
//   depth: number;
//   minDepth?: number;
//   onInfo: (info: ParsedEngineInfo) => void;
//   onBestMove?: (bestMove: string | null) => void;
// };

// export type BestMoveArgs = {
//   fen: string;
//   moveTime: number;
// };

export type EngineLineHandler = (line: string) => void;

export type StockfishEngine = {
  postMessage: (msg: string) => void;
  terminate: () => void;
  onLine: (handler: EngineLineHandler) => void;
};
