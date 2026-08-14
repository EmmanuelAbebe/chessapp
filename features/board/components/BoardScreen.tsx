"use client";

import React from "react";
import { EvalBar } from "./EvalBar";
import { EvalScoreLabel } from "./EvalScoreLabel";
import { BoardView } from "./BoardView";
import { BoardControls } from "./BoardControls";
import { BoardSettingsModal } from "./BoardSettingsModal";
import { MoveList } from "./MoveList";
import { MoveNavigation } from "./MoveNavigation";
import { AiChatPanel } from "./AiChatPanel";
import { useBoardGame } from "../hooks/useBoardGame";
import { useBoardSettings } from "../hooks/useBoardSettings";
import { useBoardPreferences } from "../hooks/useBoardPreferences";
import { useEvalScore } from "../hooks/useEvalScore";

export function BoardScreen() {
  const {
    chessPosition,
    optionSquares,
    lastMoveSquares,
    checkSquares,
    illegalSquares,
    orientation,
    analysisFen,
    currentLine,
    currentNodeId,
    canGoPrevious,
    canGoNext,
    canGoEnd,
    toggleOrientation,
    changeOrientation,
    onSquareClick,
    goToNode,
    goToStart,
    goToPrevious,
    goToNext,
    goToEnd,
  } = useBoardGame();

  const { isBoardSettingsOpen, openBoardSettings, closeBoardSettings } =
    useBoardSettings();

  const {
    showEvalBar,
    setShowEvalBar,
    showEvalScore,
    setShowEvalScore,
    showCoordinates,
    setShowCoordinates,
    coordinatesPlacement,
    setCoordinatesPlacement,
  } = useBoardPreferences();

  const evalScore = useEvalScore(
    analysisFen || chessPosition,
    14,
    showEvalBar || showEvalScore,
  );

  return (
    <>
      <div className="flex w-full flex-1 flex-col items-center justify-center gap-3 overflow-x-auto p-3 sm:p-4">
        <div className="flex w-(--board-size) flex-col gap-3 [--board-size:min(92vw,78dvh,880px)]">
          <AiChatPanel />

          <div className="flex w-full items-start gap-2">
            <EvalScoreLabel
              visible={showEvalScore}
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

            <div className="shrink-0">
              <MoveNavigation
                canGoPrevious={canGoPrevious}
                canGoNext={canGoNext}
                canGoEnd={canGoEnd}
                onStart={goToStart}
                onPrevious={goToPrevious}
                onNext={goToNext}
                onEnd={goToEnd}
              />
            </div>
          </div>

          <div className="flex h-(--board-size) w-full gap-2">
            <EvalBar
              visible={showEvalBar}
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
            />

            <BoardControls
              openBoardSettings={openBoardSettings}
              toggleOrientation={toggleOrientation}
            />
          </div>
        </div>
      </div>

      <BoardSettingsModal
        isOpen={isBoardSettingsOpen}
        onClose={closeBoardSettings}
        orientation={orientation}
        onSetOrientation={changeOrientation}
        showEvalBar={showEvalBar}
        onSetShowEvalBar={setShowEvalBar}
        showEvalScore={showEvalScore}
        onSetShowEvalScore={setShowEvalScore}
        showCoordinates={showCoordinates}
        onSetShowCoordinates={setShowCoordinates}
        coordinatesPlacement={coordinatesPlacement}
        onSetCoordinatesPlacement={setCoordinatesPlacement}
      />
    </>
  );
}
