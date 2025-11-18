// export type Position = { r: number; c: number };

export interface BoardProps {
  fen: string;
  onHumanMove?: (move: Move) => void;
}

export type Piece = {
  id: string;
  row: number;
  col: number;
  type: string;
};

export type HighlightType =
  | "selected"
  | "rightClick"
  | "lastMoveFrom"
  | "lastMoveTo"
  | "dragFrom";

export type Board = (string | null)[][];
export type Color = "white" | "black";

export interface Square {
  row: number;
  col: number;
}

export interface Move {
  from: Square;
  to: Square;
  promotion?: string; // piece letter, uppercase (e.g. "Q")
  enPassant?: boolean;
  doublePawn?: boolean;
  castling?: "king" | "queen";
}

export interface CastlingRights {
  K?: boolean;
  Q?: boolean;
  k?: boolean;
  q?: boolean;
}

// export const highlightStyles: Record<HighlightType, string> = {
//   selected: "bg-green-400/45",
//   rightClick: "bg-blue-500/25",
//   lastMoveFrom: "bg-yellow-400/65",
//   lastMoveTo: "bg-yellow-300/55",
//   dragFrom: "bg-orange-400/40",
// };

// export interface SquareProps {
//   row: number;
//   col: number;
//   piece?: string;
//   highlights?: HighlightType[];
//   onMouseDown?: (
//     row: number,
//     col: number,
//     piece: string,
//     e: React.MouseEvent
//   ) => void;
//   onClick?: (row: number, col: number) => void;
//   onContextMenu?: (row: number, col: number, e: React.MouseEvent) => void;
// }

// export type Arrow = { from: Position; to: Position };
