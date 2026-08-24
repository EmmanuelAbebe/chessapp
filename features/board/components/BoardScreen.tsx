"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { Arrow } from "react-chessboard";
import { EvalBar } from "./EvalBar";
import { EvalScoreLabel } from "./EvalScoreLabel";
import { BoardView } from "./BoardView";
import { BoardControls } from "./BoardControls";
import { BoardSettingsModal } from "./BoardSettingsModal";
import { GameModeModal } from "./GameModeModal";
import { MoveList } from "./MoveList";
import { MoveNavigation } from "./MoveNavigation";
import { AiChatPanel } from "./AiChatPanel";
import { useBoardGame } from "../hooks/useBoardGame";
import { useBoardSettings } from "../hooks/useBoardSettings";
import { useEvalScore, type CandidateMove } from "../hooks/useEvalScore";
import { useGameMode } from "../hooks/useGameMode";
import { useEngineOpponent } from "../hooks/useEngineOpponent";
import { selectCloseCandidates } from "../lib/eval-format";
import { useSettings } from "@/features/settings/SettingsContext";

const AI_ARROW_OPACITIES = [0.9, 0.65, 0.45, 0.3];

export function BoardScreen() {
  const {
    chessPosition,
    optionSquares,
    lastMoveSquares,
    checkSquares,
    illegalSquares,
    orientation,
    analysisFen,
    turn,
    gameStatus,
    currentLine,
    currentNodeId,
    canGoPrevious,
    canGoNext,
    toggleOrientation,
    changeOrientation,
    onSquareClick,
    resetBoard,
    playUciMove,
    goToNode,
    goToStart,
    goToPrevious,
    goToNext,
    goToEnd,
  } = useBoardGame();

  const { isBoardSettingsOpen, openBoardSettings, closeBoardSettings } =
    useBoardSettings();

  const [isGameModeOpen, setIsGameModeOpen] = useState(false);
  const gameMode = useGameMode();
  const isPlayingStockfish = gameMode.mode === "vsStockfish";

  useEngineOpponent({
    enabled: isPlayingStockfish,
    fen: chessPosition,
    turn,
    playerSide: gameMode.playerSide === "white" ? "w" : "b",
    skillLevel: gameMode.skillLevel,
    onMove: playUciMove,
  });

  const { settings } = useSettings();
  const {
    showEvalBar,
    showEvalScore,
    showEngineSuggestions,
    showCoordinates,
    coordinatesPlacement,
    showMoveList,
  } = settings;

  // --board-size drives width/height for the whole board-page composition
  // (chat panel, move-list row, board itself all share it). It's set from
  // 100dvh minus the actual fixed-pixel chrome around it - sticky header
  // (56px), outer padding (32px), AiChatPanel (112px), gaps (12px each),
  // and the move-list row (36px, always reserved so toggling it fades in
  // place instead of resizing/shifting the board) - so the page never
  // grows taller than the viewport and needs to scroll.
  const boardSizeValue = "min(90vw, calc(100dvh - 260px), 1100px)";

  // Suggestions/eval reveal what the engine would play - hide them entirely
  // while it's the opponent in an actual game, not just the arrows.
  const analysisEnabled =
    !isPlayingStockfish &&
    (showEvalBar || showEvalScore || showEngineSuggestions);

  const evalScore = useEvalScore(analysisFen || chessPosition, 14, analysisEnabled);

  // Stockfish's top candidate moves (MultiPV) rendered as AI-drawn arrows,
  // in blue to stay distinct from user-drawn ones (library default #ffaa00).
  // Shows the full leading cluster of moves that are within ~half a pawn of
  // the best move (typically 3-4 in a close position), trimming down to
  // just the best 1-2 once there's a clear gap.
  const aiArrows = useMemo<Arrow[]>(() => {
    if (!showEngineSuggestions || isPlayingStockfish) return [];

    const ranked = evalScore.candidates.filter(
      (candidate): candidate is CandidateMove => candidate !== undefined,
    );
    const shown = selectCloseCandidates(ranked);

    return shown.map((candidate, index) => ({
      startSquare: candidate.move.slice(0, 2),
      endSquare: candidate.move.slice(2, 4),
      color: `rgba(59, 130, 246, ${AI_ARROW_OPACITIES[index] ?? 0.3})`,
    }));
  }, [evalScore.candidates, showEngineSuggestions, isPlayingStockfish]);

  // Give the final move/highlight a moment to settle on the board before
  // covering it with the result.
  useEffect(() => {
    if (!gameStatus.isOver) return;

    const timeout = setTimeout(() => setIsGameModeOpen(true), 500);
    return () => clearTimeout(timeout);
  }, [gameStatus.isOver]);

  function handleStartNewGame() {
    gameMode.startAnalysis();
    resetBoard();
  }

  function handleStartVsStockfish(
    side: Parameters<typeof gameMode.startVsStockfish>[0],
    skillLevel: number,
  ) {
    const resolvedSide = gameMode.startVsStockfish(side, skillLevel);
    resetBoard();
    changeOrientation(resolvedSide);
  }

  return (
    <>
      <div className="flex w-full flex-1 flex-col items-center justify-center gap-3 overflow-x-auto p-3 sm:p-4">
        <div
          className="flex w-(--board-size) flex-col gap-3"
          style={{ "--board-size": boardSizeValue } as React.CSSProperties}
        >
          <AiChatPanel
            moveNumber={currentLine[currentLine.length - 1]?.moveNumber ?? 0}
          />

          <div
            className={`flex h-9 w-full items-center gap-2 transition-opacity duration-200 ease-out ${
              showMoveList ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
          >
            <EvalScoreLabel
              visible={showEvalScore && !isPlayingStockfish}
              displayScore={evalScore.displayScore}
              displayMate={evalScore.displayMate}
            />

            <div className="min-w-0 flex-1">
              <MoveList
                currentLine={currentLine}
                currentNodeId={currentNodeId}
                onSelectNode={goToNode}
                onSelectStart={goToStart}
              />
            </div>

            <MoveNavigation
              canGoPrevious={canGoPrevious}
              canGoNext={canGoNext}
              onStart={goToStart}
              onPrevious={goToPrevious}
              onNext={goToNext}
              onEnd={goToEnd}
            />
          </div>

          <div className="flex h-(--board-size) w-full gap-2">
            <EvalBar
              visible={showEvalBar && !isPlayingStockfish}
              whitePercent={evalScore.whitePercent}
              depth={evalScore.depth}
              bestMove={evalScore.bestMove}
            />

            <BoardView
              chessPosition={chessPosition}
              orientation={orientation}
              optionSquares={{
                ...lastMoveSquares,
                ...checkSquares,
                ...optionSquares,
                ...illegalSquares,
              }}
              onSquareClick={onSquareClick}
              showCoordinates={showCoordinates}
              coordinatesPlacement={coordinatesPlacement}
              aiArrows={aiArrows}
            />

            <BoardControls
              openBoardSettings={openBoardSettings}
              openGameMode={() => setIsGameModeOpen(true)}
              toggleOrientation={toggleOrientation}
            />
          </div>
        </div>
      </div>

      <BoardSettingsModal
        isOpen={isBoardSettingsOpen}
        onClose={closeBoardSettings}
      />

      <GameModeModal
        isOpen={isGameModeOpen}
        onClose={() => setIsGameModeOpen(false)}
        onStartNewGame={handleStartNewGame}
        onStartVsStockfish={handleStartVsStockfish}
        gameStatus={gameStatus}
      />
    </>
  );
}
