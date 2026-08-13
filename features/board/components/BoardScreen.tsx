"use client";

import React from "react";
import { EvalBar } from "./EvalBar";
import { BoardView } from "./BoardView";
import { BoardControls } from "./BoardControls";
import { BoardSettingsModal } from "./BoardSettingsModal";
import { MoveList } from "./MoveList";
import { MoveNavigation } from "./MoveNavigation";
import { AiChatPanel } from "./AiChatPanel";
import { useBoardGame } from "../hooks/useBoardGame";
import { useBoardSettings } from "../hooks/useBoardSettings";
import { useBoardPreferences } from "../hooks/useBoardPreferences";

export function BoardScreen() {
  const {
    chessPosition,
    optionSquares,
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
    showCoordinates,
    setShowCoordinates,
    coordinatesPlacement,
    setCoordinatesPlacement,
  } = useBoardPreferences();

  return (
    <>
      <div className="flex w-full flex-1 flex-col items-center justify-center gap-3 overflow-x-auto p-3 sm:p-4">
        <div className="flex w-(--board-size) flex-col gap-3 [--board-size:min(92vw,78dvh,880px)]">
          <AiChatPanel />

          <div className="flex w-full items-start justify-between gap-3">
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

          <div className="flex h-(--board-size) w-full items-start justify-center gap-3">
            {showEvalBar && (
              <EvalBar
                fen={analysisFen || chessPosition}
                orientation={orientation}
                depth={14}
              />
            )}

            <div className="relative h-(--board-size) w-(--board-size)">
              <BoardView
                chessPosition={chessPosition}
                orientation={orientation}
                optionSquares={optionSquares}
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
      </div>

      <BoardSettingsModal
        isOpen={isBoardSettingsOpen}
        onClose={closeBoardSettings}
        orientation={orientation}
        onSetOrientation={changeOrientation}
        showEvalBar={showEvalBar}
        onSetShowEvalBar={setShowEvalBar}
        showCoordinates={showCoordinates}
        onSetShowCoordinates={setShowCoordinates}
        coordinatesPlacement={coordinatesPlacement}
        onSetCoordinatesPlacement={setCoordinatesPlacement}
      />
    </>
  );
}
