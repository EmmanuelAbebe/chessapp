// export type BoardOrientation = "white" | "black";
// export type BoardMode = "play" | "review";
// export type GameWinner = "White" | "Black" | "Draw";

// export type GameResult = {
//   winner: GameWinner;
//   reason: "checkmate" | "stalemate" | "draw";
// };

// export type MoveEntry = {
//   ply: number;
//   moveNumber: number;
//   color: "w" | "b";
//   san: string;
//   lan: string;
//   from: string;
//   to: string;
//   fenAfter: string;
//   isCheck: boolean;
//   isMate: boolean;
//   isCapture: boolean;
//   promotion?: string;
// };

// export type BoardTheme = {
//   name: string;
//   lightSquare: string;
//   darkSquare: string;
//   borderRadius?: string;
// };

// export type BoardAnalysisState = {
//   whiteScore: number;
//   mate: number | null;
//   bestMove: string | null;
//   depth: number;
//   isThinking: boolean;
// };

// export type BoardSettings = {
//   themeName: string;
//   engineDepth: number;
//   engineMoveTime: number;
//   showChat: boolean;
//   showEvalBar: boolean;
// };

import type React from "react";

export type Orientation = "white" | "black";

export type CoordinatesPlacement = "inside" | "outside";

export type OptionSquares = Record<string, React.CSSProperties>;

export type MoveNode = {
  id: string;
  parentId: string | null;
  children: string[];

  san: string | null;
  uci: string | null;
  fen: string;

  ply: number;
  moveNumber: number;
  side: "w" | "b" | null;

  comment?: string;
};

export type MoveTreeState = {
  rootId: string;
  currentNodeId: string;
  nodes: Record<string, MoveNode>;
};
