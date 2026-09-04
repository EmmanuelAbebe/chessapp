"use client";

import React, { type ComponentType } from "react";
import { FaPuzzlePiece } from "react-icons/fa";
import {
  FaBookOpen,
  FaChalkboardUser,
  FaChessBoard,
  FaFileImport,
  FaFish,
  FaRobot,
} from "react-icons/fa6";
import { GrConfigure } from "react-icons/gr";
import { HiSwitchVertical } from "react-icons/hi";
import { IoArrowUndo } from "react-icons/io5";

type BoardControlsProps = {
  toggleOrientation: () => void;
  openBoardSettings: () => void;
  openStockfishSetup: () => void;
  openPositionSetup: () => void;
  openImportGame: () => void;
  openAiCoach: () => void;
  openPuzzles: () => void;
  onAnalysis: () => void;
  onUndo: () => void;
  // Vertical beside the board on desktop; horizontal below the move list on
  // mobile, where there's no side column to put a tall stack of icons in.
  layout?: "column" | "row";
};

/** An icon button with a hover/focus tooltip label, styled to match the
 * site header's own dial-item tooltip (same pill: rounded-md border
 * border-white/10 bg-surface px-2 py-1 text-xs text-text-dim shadow-lg,
 * fading in via opacity rather than being always visible) instead of the
 * browser's native `title` tooltip. Positioned relative to the icon
 * itself (not inline, unlike the header's) so it doesn't disturb this
 * menu's tight icon spacing - to the side for the vertical desktop
 * column, above for the horizontal mobile row. */
function IconButton({
  icon: Icon,
  label,
  onClick,
  layout,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  layout: "column" | "row";
}) {
  return (
    <span className="group relative flex">
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className="rounded text-text-faint transition hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <Icon />
      </button>
      <span
        role="tooltip"
        className={`pointer-events-none absolute z-10 rounded-md border border-white/10 bg-surface px-2 py-1 text-xs whitespace-nowrap text-text-dim opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 ${
          layout === "row"
            ? "bottom-full left-1/2 mb-2 -translate-x-1/2"
            : "top-1/2 left-full ml-2 -translate-y-1/2"
        }`}
      >
        {label}
      </span>
    </span>
  );
}

export function BoardControls({
  toggleOrientation,
  openBoardSettings,
  openStockfishSetup,
  openPositionSetup,
  openImportGame,
  openAiCoach,
  openPuzzles,
  onAnalysis,
  onUndo,
  layout = "column",
}: BoardControlsProps) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center gap-3 p-2 ${layout === "row" ? "flex-row" : "flex-col"}`}
    >
      <IconButton
        icon={IoArrowUndo}
        label="Undo last move"
        onClick={onUndo}
        layout={layout}
      />
      <IconButton
        icon={FaFish}
        label="Play against Stockfish"
        onClick={openStockfishSetup}
        layout={layout}
      />
      <IconButton
        icon={FaChessBoard}
        label="Set up position"
        onClick={openPositionSetup}
        layout={layout}
      />
      <IconButton
        icon={FaFileImport}
        label="Import game"
        onClick={openImportGame}
        layout={layout}
      />
      <IconButton
        icon={FaChalkboardUser}
        label="Play against AI Coach"
        onClick={openAiCoach}
        layout={layout}
      />
      <IconButton
        icon={FaPuzzlePiece}
        label="Puzzles"
        onClick={openPuzzles}
        layout={layout}
      />
      <IconButton
        icon={FaBookOpen}
        label="Analysis"
        onClick={onAnalysis}
        layout={layout}
      />
      <IconButton
        icon={GrConfigure}
        label="Board settings"
        onClick={openBoardSettings}
        layout={layout}
      />
      <IconButton
        icon={HiSwitchVertical}
        label="Flip board"
        onClick={toggleOrientation}
        layout={layout}
      />
    </div>
  );
}
