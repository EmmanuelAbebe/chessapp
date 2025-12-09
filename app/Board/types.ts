// export type Position = { r: number; c: number };

import { Orientation } from "./useChessGame";

export interface BoardProps {
  fen: string;
  orientation?: "white" | "black"; // default "white"
}

export type Board = (string | null)[][];
export type Color = "white" | "black";

export const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
export const ranks = ["1", "2", "3", "4", "5", "6", "7", "8"];

export type RenderPiece = {
  type: "p" | "n" | "b" | "r" | "q" | "k";
  color: "w" | "b";
};

export type SquareIndex = {
  row: number;
  col: number;
};

export type RenderBoard = (RenderPiece | null)[][]; // [row][col], row 0 = rank 8
