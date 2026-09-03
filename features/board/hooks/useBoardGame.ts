"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Chess, type Square } from "chess.js";
import type { SquareHandlerArgs } from "react-chessboard";
import type { Orientation, OptionSquares } from "../types";
import { getMoveOptions } from "../lib/board-helpers";
import { getGameStatus } from "../lib/game-status";
import { useMoveTree } from "./useMoveTree";
import { useGameMode } from "./useGameMode";
import { useEngineOpponent } from "./useEngineOpponent";
import { useSettings } from "@/features/settings/SettingsContext";

const ILLEGAL_MOVE_FLASH_MS = 400;

export function useBoardGame() {
  const moveTree = useMoveTree();
  const { settings, updateSettings } = useSettings();
  const orientation = settings.orientation;

  const [optionSquares, setOptionSquares] = useState<OptionSquares>({});
  const [moveFrom, setMoveFrom] = useState("");
  const [illegalSquare, setIllegalSquare] = useState<string | null>(null);
  const illegalTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  useEffect(() => {
    return () => {
      if (illegalTimeoutRef.current) clearTimeout(illegalTimeoutRef.current);
    };
  }, []);

  const analysisFen = moveTree.currentFen;

  const currentChess = useMemo(
    () => new Chess(moveTree.currentFen),
    [moveTree.currentFen],
  );

  const gameStatus = useMemo(() => getGameStatus(currentChess), [currentChess]);

  const lastMoveSquares = useMemo<OptionSquares>(() => {
    if (!settings.highlightLastMove) return {};

    const uci = moveTree.currentNode.uci;
    if (!uci) return {};

    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const highlight = { backgroundColor: "rgba(255, 170, 0, 0.3)" };

    return { [from]: highlight, [to]: highlight };
  }, [moveTree.currentNode.uci, settings.highlightLastMove]);

  const checkSquares = useMemo<OptionSquares>(() => {
    if (!settings.highlightCheck) return {};
    if (!currentChess.isCheck()) return {};

    const turn = currentChess.turn();
    const kingSquare = currentChess
      .board()
      .flat()
      .find((piece) => piece?.type === "k" && piece.color === turn)?.square;

    if (!kingSquare) return {};

    const isMate = currentChess.isCheckmate();

    return {
      [kingSquare]: {
        backgroundColor: isMate
          ? "rgba(220, 38, 38, 0.55)"
          : "rgba(220, 38, 38, 0.35)",
        transition: "background-color 150ms ease-out",
      },
    };
  }, [currentChess, settings.highlightCheck]);

  const illegalSquares = useMemo<OptionSquares>(() => {
    if (!illegalSquare) return {};

    return {
      [illegalSquare]: {
        backgroundColor: "rgba(239, 68, 68, 0.45)",
        transition: "background-color 150ms ease-out",
      },
    };
  }, [illegalSquare]);

  function flashIllegalSquare(square: string) {
    if (illegalTimeoutRef.current) clearTimeout(illegalTimeoutRef.current);
    setIllegalSquare(square);
    illegalTimeoutRef.current = setTimeout(() => {
      setIllegalSquare(null);
    }, ILLEGAL_MOVE_FLASH_MS);
  }

  function clearSelection() {
    setMoveFrom("");
    setOptionSquares({});
  }

  function toggleOrientation() {
    updateSettings({
      orientation: orientation === "white" ? "black" : "white",
    });
  }

  function onSquareClick({ square, piece }: SquareHandlerArgs) {
    if (currentChess.isGameOver()) return;

    if (!moveFrom && piece) {
      const nextOptions = getMoveOptions(
        currentChess,
        square as Square,
        settings.showLegalMoves,
      );
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
      const nextOptions = getMoveOptions(
        currentChess,
        square as Square,
        settings.showLegalMoves,
      );

      if (!nextOptions) {
        flashIllegalSquare(square);
      }

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

  // A custom `startFen` re-roots the whole tree there instead of the
  // standard starting position - lets a study session begin from any
  // position: a variation picked up deep into an opening (the map's "Set
  // as start position" passes the previewed node's own fen), or an
  // endgame-tactic FEN typed in that isn't reachable by playing from move
  // 1 at all.
  function resetBoard(startFen?: string) {
    moveTree.resetTree(startFen);
    clearSelection();
  }

  function playUciMove(uci: string) {
    if (currentChess.isGameOver()) return;

    moveTree.playMove({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci.slice(4) || undefined,
    });

    clearSelection();
  }

  function changeOrientation(nextOrientation: Orientation) {
    updateSettings({ orientation: nextOrientation });
  }

  // Lives here (not in BoardScreen) so it survives navigating to the map
  // and back - it's part of the shared game, not board-page UI state.
  // Undoing, jumping to another node, or leaving for the map page never
  // touches it, so who you're playing against stays put regardless of
  // where in the tree you look.
  const gameMode = useGameMode();
  const isPlayingStockfish = gameMode.mode === "vsStockfish";

  const { isThinking: isEngineThinking } = useEngineOpponent({
    enabled: isPlayingStockfish,
    fen: moveTree.currentFen,
    turn: currentChess.turn(),
    playerSide: gameMode.playerSide === "white" ? "w" : "b",
    skillLevel: gameMode.skillLevel,
    onMove: playUciMove,
  });

  return {
    orientation,
    optionSquares,
    lastMoveSquares,
    checkSquares,
    illegalSquares,
    analysisFen,
    chessPosition: moveTree.currentFen,
    turn: currentChess.turn(),
    gameStatus,

    tree: moveTree.tree,
    currentLine: moveTree.currentLine,
    currentChildren: moveTree.currentChildren,
    currentNodeId: moveTree.currentNodeId,

    gameMode: gameMode.mode,
    isPlayingStockfish,
    isEngineThinking,
    playerSide: gameMode.playerSide,
    skillLevel: gameMode.skillLevel,
    startAnalysis: gameMode.startAnalysis,
    startVsStockfish: gameMode.startVsStockfish,

    canGoPrevious: moveTree.canGoPrevious,
    canGoNext: moveTree.canGoNext,
    canGoEnd: moveTree.canGoEnd,
    canGoPreviousVariation: moveTree.canGoPreviousVariation,
    canGoNextVariation: moveTree.canGoNextVariation,

    toggleOrientation,
    changeOrientation,
    onSquareClick,
    resetBoard,
    playUciMove,
    playMoveAt: moveTree.playMoveAt,

    goToNode: moveTree.goToNode,
    goToStart: moveTree.goToStart,
    goToPrevious: moveTree.goToPrevious,
    undoMove: moveTree.undoMove,
    goToNext: moveTree.goToNext,
    goToEnd: moveTree.goToEnd,
    goToPreviousVariation: moveTree.goToPreviousVariation,
    goToNextVariation: moveTree.goToNextVariation,
  };
}
