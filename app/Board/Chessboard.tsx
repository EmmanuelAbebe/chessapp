// app/Board/Chessboard.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Board from "./components/Board";
import { RenderBoard, RenderPiece, SquareIndex } from "./types";
import { useChessGame } from "./useChessGame";
import { startPosition, positions } from "./FEN";
import "./styles/chesspiece.css";
import Button from "@/common/Button";

type DragSource =
  | {
      from: "board";
      square: SquareIndex;
      piece: RenderPiece;
    }
  | {
      from: "palette";
      piece: RenderPiece;
    };

export default function ChessBoardUI() {
  const [positionIndex, setPositionIndex] = useState(1);

  const { game, orientation, flipOrientation } = useChessGame(
    positions[positionIndex],
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

  const [setupBoard, setSetupBoard] = useState<RenderBoard>(renderBoard);

  const [dragSource, setDragSource] = useState<DragSource | null>(null);

  const handleSquareMouseDown = (square: SquareIndex, e: any) => {
    if (e.button !== 0) return; // left mouse only

    const { row, col } = square;
    const piece = setupBoard[row][col];
    if (!piece) {
      setDragSource(null);
      return;
    }

    setDragSource({ from: "board", square, piece });
  };

  const handleSquareMouseUp = (square: SquareIndex, e: any) => {
    if (e.button !== 0) return;
    if (!dragSource) return;

    const { row: toRow, col: toCol } = square;

    setSetupBoard((prev) => {
      const next = prev.map((r) => r.slice()) as RenderBoard;

      // place piece on target
      next[toRow][toCol] = dragSource.piece;

      // clear source if it was from board
      if (dragSource.from === "board") {
        const { row: fromRow, col: fromCol } = dragSource.square;
        next[fromRow][fromCol] = null;
      }

      return next;
    });

    setDragSource(null);
  };

  // Helpers for palette pieces
  const paletteMouseDown = (piece: RenderPiece) => {
    setDragSource({ from: "palette", piece });
  };

  useEffect(() => {
    setSetupBoard(renderBoard);
  }, [renderBoard, positionIndex]);
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

        {/* button to change though store fen positions */}
        <Button
          label={"Change position"}
          onClick={() =>
            setPositionIndex((positionIndex + 1) % positions.length)
          }
        />
      </div>
      <p className="p-1"> {positions[positionIndex]}</p>{" "}
      {/*display current fen notation*/}
      <div className="flex flex-row gap-2 ">
        <Board board={setupBoard} orientation={orientation} />
        {/* palette */}
        <div className="flex flex-row">
          <div className="flex flex-col">
            <div
              className="w-[50px] h-[50px] piece-k bg-contain bg-no-repeat"
              onMouseDown={() => paletteMouseDown({ type: "k", color: "b" })}
            />
            <div
              className="w-[50px] h-[50px] piece-q bg-contain bg-no-repeat"
              onMouseDown={() => paletteMouseDown({ type: "q", color: "b" })}
            />
            <div
              className="w-[50px] h-[50px] piece-r bg-contain bg-no-repeat"
              onMouseDown={() => paletteMouseDown({ type: "r", color: "b" })}
            />
            <div
              className="w-[50px] h-[50px] piece-b bg-contain bg-no-repeat"
              onMouseDown={() => paletteMouseDown({ type: "b", color: "b" })}
            />
            <div
              className="w-[50px] h-[50px] piece-n bg-contain bg-no-repeat"
              onMouseDown={() => paletteMouseDown({ type: "n", color: "b" })}
            />
            <div
              className="w-[50px] h-[50px] piece-p bg-contain bg-no-repeat"
              onMouseDown={() => paletteMouseDown({ type: "p", color: "b" })}
            />
          </div>

          <div className="flex flex-col">
            <div
              className="w-[50px] h-[50px] piece-K bg-contain bg-no-repeat"
              onMouseDown={() => paletteMouseDown({ type: "k", color: "w" })}
            />
            <div
              className="w-[50px] h-[50px] piece-Q bg-contain bg-no-repeat"
              onMouseDown={() => paletteMouseDown({ type: "q", color: "w" })}
            />
            <div
              className="w-[50px] h-[50px] piece-R bg-contain bg-no-repeat"
              onMouseDown={() => paletteMouseDown({ type: "r", color: "w" })}
            />
            <div
              className="w-[50px] h-[50px] piece-B bg-contain bg-no-repeat"
              onMouseDown={() => paletteMouseDown({ type: "b", color: "w" })}
            />
            <div
              className="w-[50px] h-[50px] piece-N bg-contain bg-no-repeat"
              onMouseDown={() => paletteMouseDown({ type: "n", color: "w" })}
            />
            <div
              className="w-[50px] h-[50px] piece-P bg-contain bg-no-repeat"
              onMouseDown={() => paletteMouseDown({ type: "p", color: "w" })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
