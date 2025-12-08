// app/Board/Chessboard.tsx
"use client";

import { useMemo, useState } from "react";
import { Chess } from "chess.js";
import Board from "./components/Board";
import { RenderBoard } from "./types";
import { useChessGame } from "./useChessGame";
import { startPosition } from "./FEN";
import "./styles/chesspiece.css";
import { TiLightbulb } from "react-icons/ti";
import Button from "@/common/Button";

export default function ChessBoardUI() {
  const { game, orientation, flipOrientation } = useChessGame(
    startPosition,
    "white"
  );

  const renderBoard: RenderBoard = useMemo(() => {
    const b = game.board(); // Piece | null
    return b.map((row) =>
      row.map((cell) =>
        cell
          ? { type: cell.type, color: cell.color } // RenderPiece
          : null
      )
    );
  }, [game]);

  return (
    <div className="flex flex-col gap-2 items-center">
      <div className="flex gap-1">
        <Button
          className=" justify-center flex flex-row gap-2"
          label={
            <>
              <p className="py-2">flip board to</p>
              {orientation === "white" ? (
                <div className="w-[30px] h-[30px] piece-k bg-contain bg-no-repeat"></div>
              ) : (
                <div className="w-[30px] h-[30px] piece-K bg-contain bg-no-repeat"></div>
              )}
            </>
          }
          onClick={flipOrientation}
        />
        <Button
          label={
            <span className="m-auto">
              <TiLightbulb />
            </span>
          }
          onClick={() => alert("hint not yet implemented")}
        />
      </div>

      <Board board={renderBoard} orientation={orientation} />
    </div>
  );
}
