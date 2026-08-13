"use client";

import React from "react";
import { EvalBar } from "./EvalBar";
import { BoardView } from "./BoardView";
import { BoardControls } from "./BoardControls";
import { ChatPanel } from "./ChatPanel";
import { BoardSettingsModal } from "./BoardSettingsModal";
import { MoveList } from "./MoveList";
import { MoveNavigation } from "./MoveNavigation";
import { useBoardGame } from "../hooks/useBoardGame";
import { useBoardSettings } from "../hooks/useBoardSettings";

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

  return (
    <>
      <div className="flex w-full flex-1 items-center justify-center overflow-x-auto p-6">
        <div className="flex items-start gap-4 h-150">
          <section className="flex items-start gap-4 h-full">
            <EvalBar
              fen={analysisFen || chessPosition}
              orientation={orientation}
              depth={14}
            />

            <BoardView
              chessPosition={chessPosition}
              orientation={orientation}
              optionSquares={optionSquares}
              onSquareClick={onSquareClick}
            />

            <BoardControls
              openBoardSettings={openBoardSettings}
              toggleOrientation={toggleOrientation}
            />
          </section>

          <section className="flex w-155 shrink-0 flex-col gap-3 h-full">
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

            <ChatPanel />
          </section>
        </div>
      </div>

      <BoardSettingsModal
        isOpen={isBoardSettingsOpen}
        onClose={closeBoardSettings}
        orientation={orientation}
        onSetOrientation={changeOrientation}
      />
    </>
  );
}
