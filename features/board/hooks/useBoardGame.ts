"use client";

import { useMemo, useState } from "react";
import { Chess, type Square } from "chess.js";
import type { SquareHandlerArgs } from "react-chessboard";
import type { Orientation, OptionSquares } from "../types";
import { getMoveOptions } from "../lib/board-helpers";
import { useMoveTree } from "./useMoveTree";

export function useBoardGame() {
  const moveTree = useMoveTree();

  const [orientation, setOrientation] = useState<Orientation>("white");
  const [optionSquares, setOptionSquares] = useState<OptionSquares>({});
  const [moveFrom, setMoveFrom] = useState("");

  const analysisFen = moveTree.currentFen;

  const currentChess = useMemo(
    () => new Chess(moveTree.currentFen),
    [moveTree.currentFen],
  );

  function clearSelection() {
    setMoveFrom("");
    setOptionSquares({});
  }

  function toggleOrientation() {
    setOrientation((current) => (current === "white" ? "black" : "white"));
  }

  function onSquareClick({ square, piece }: SquareHandlerArgs) {
    if (currentChess.isGameOver()) return;

    if (!moveFrom && piece) {
      const nextOptions = getMoveOptions(currentChess, square as Square);
      setOptionSquares(nextOptions ?? {});
      if (nextOptions) setMoveFrom(square);
      return;
    }

    const moves = currentChess.moves({
      square: moveFrom as Square,
      verbose: true,
    });

    const foundMove = moves.find((m) => m.from === moveFrom && m.to === square);

    if (!foundMove) {
      const nextOptions = getMoveOptions(currentChess, square as Square);
      setOptionSquares(nextOptions ?? {});
      setMoveFrom(nextOptions ? square : "");
      return;
    }

    moveTree.playMove({
      from: moveFrom,
      to: square,
      promotion: "q",
    });

    clearSelection();
  }

  function resetBoard() {
    moveTree.resetTree();
    clearSelection();
  }

  function changeOrientation(nextOrientation: Orientation) {
    setOrientation(nextOrientation);
  }

  return {
    orientation,
    optionSquares,
    analysisFen,
    chessPosition: moveTree.currentFen,

    currentLine: moveTree.currentLine,
    currentChildren: moveTree.currentChildren,
    currentNodeId: moveTree.currentNodeId,

    canGoPrevious: moveTree.canGoPrevious,
    canGoNext: moveTree.canGoNext,
    canGoEnd: moveTree.canGoEnd,
    canGoPreviousVariation: moveTree.canGoPreviousVariation,
    canGoNextVariation: moveTree.canGoNextVariation,

    toggleOrientation,
    changeOrientation,
    onSquareClick,
    resetBoard,

    goToNode: moveTree.goToNode,
    goToStart: moveTree.goToStart,
    goToPrevious: moveTree.goToPrevious,
    goToNext: moveTree.goToNext,
    goToEnd: moveTree.goToEnd,
    goToPreviousVariation: moveTree.goToPreviousVariation,
    goToNextVariation: moveTree.goToNextVariation,
  };
}
