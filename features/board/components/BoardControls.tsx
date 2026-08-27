"use client";

import React from "react";
import { FaBookOpen, FaPlay } from "react-icons/fa6";
import { GrConfigure } from "react-icons/gr";
import { HiSwitchVertical } from "react-icons/hi";

type BoardControlsProps = {
  toggleOrientation: () => void;
  openBoardSettings: () => void;
  openGameMode: () => void;
  onAnalysis: () => void;
};

export function BoardControls({
  toggleOrientation,
  openBoardSettings,
  openGameMode,
  onAnalysis,
}: BoardControlsProps) {
  return (
    <div className="flex shrink-0 flex-col items-center gap-3 p-2">
      <button
        type="button"
        onClick={openGameMode}
        aria-label="Game mode"
        title="Game mode"
        className="rounded text-text-faint transition hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <FaPlay />
      </button>
      <button
        type="button"
        onClick={onAnalysis}
        aria-label="Analysis"
        title="Analysis"
        className="rounded text-text-faint transition hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <FaBookOpen />
      </button>
      <button
        type="button"
        onClick={openBoardSettings}
        aria-label="Board settings"
        title="Board settings"
        className="rounded text-text-faint transition hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <GrConfigure />
      </button>
      <button
        type="button"
        onClick={toggleOrientation}
        aria-label="Flip board"
        title="Flip board"
        className="rounded text-text-faint transition hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <HiSwitchVertical />
      </button>
    </div>
  );
}
