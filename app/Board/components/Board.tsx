// app/Board/components/Board.tsx
"use client";

import { JSX, useMemo } from "react";
import { Chess } from "chess.js";

import "../styles/boardsquare.css";
import "../styles/chesspiece.css";
import "../styles/board.css";
import { BoardProps, files, ranks, RenderBoard } from "../types";
import { Orientation } from "../useChessGame";

type BoardComponentProps = {
  board: RenderBoard;
  orientation: Orientation;
};

export default function Board({
  board,
  orientation = "white",
}: BoardComponentProps) {
  const squareOverlays: JSX.Element[] = [];
  const pieces: JSX.Element[] = [];

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      // logical piece at this (row,col)
      const piece = board[row][col];

      // visual fen depends on orientation
      const visualRow = orientation === "white" ? row : 7 - row;
      const visualCol = orientation === "white" ? col : 7 - col;
      const squareClass = `square-${visualRow}${visualCol}`;

      // base overlay square (for highlights / events later)
      squareOverlays.push(
        <div key={`sq-${row}-${col}`} className={`square-pos ${squareClass}`} />
      );

      if (piece) {
        // chess.js piece: { type: 'p'|'n'|'b'|'r'|'q'|'k', color: 'w'|'b' }
        const letter =
          piece.color === "w"
            ? piece.type.toUpperCase() // "P","N","B","R","Q","K"
            : piece.type; // "p","n","b","r","q","k"

        pieces.push(
          <div
            key={`p-${row}-${col}`}
            className={`piece piece-${letter} ${squareClass}`}
          />
        );
      }
    }
  }

  return (
    <div
      className="w-full flex flex-col items-center"
      style={{
        // board: min(70vw,70vh,640px) + eval bar + gap + side padding
        width: "calc(min(70vw, 70vh, 640px) + 50px)",
        maxWidth: "100%",
      }}
    >
      {/* top area (buttons later) */}
      <div className="flex gap-1 justify-start w-full p-2" />

      <div className="w-full flex justify-center gap-2 max-w-5xl p-2 bg-gray-600">
        {/* eval bar placeholder */}
        <div className="flex flex-col justify-center">
          <div className="h-full">{/* EvalBar later */}</div>
        </div>

        {/* board */}
        <div
          className="relative aspect-square bg-chessboard select-none touch-none overscroll-none flex-[0_0_auto]"
          style={{
            width: "min(70vw, 70vh, 640px)",
          }}
          onContextMenu={(e) => e.preventDefault()}
        >
          {/* overlays */}
          {squareOverlays}

          {/* pieces */}
          {pieces}

          {/* coordinates */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox="0 0 8 8"
          >
            {/* files (a–h) along the bottom, adjusted for orientation */}
            <g>
              {files.map((f, idx) => {
                const col = orientation === "white" ? idx : 7 - idx;
                return (
                  <text
                    key={`file-${f}`}
                    x={col + 0.8}
                    y={7.8}
                    textAnchor="start"
                    dominantBaseline="hanging"
                    fontSize={0.2}
                    fill="black"
                  >
                    {f}
                  </text>
                );
              })}
            </g>

            {/* ranks (1–8) on the left, adjusted for orientation */}
            <g>
              {ranks.map((r, idx) => {
                const rankIndex = orientation === "white" ? idx : 7 - idx;
                const rowFromTop = 7 - rankIndex;
                return (
                  <text
                    key={`rank-${r}`}
                    x={0.2}
                    y={rowFromTop + 0.1}
                    textAnchor="end"
                    dominantBaseline="hanging"
                    fontSize={0.2}
                    fill="black"
                  >
                    {r}
                  </text>
                );
              })}
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
}
