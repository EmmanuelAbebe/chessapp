"use client";

import React from "react";
import Link from "next/link";
import { FaChess, FaGear, FaSitemap } from "react-icons/fa6";
import { HiSwitchVertical } from "react-icons/hi";

type BoardControlsProps = {
  toggleOrientation: () => void;
  openBoardSettings: () => void;
  openGameMode: () => void;
};

export function BoardControls({
  toggleOrientation,
  openBoardSettings,
  openGameMode,
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
        <FaChess />
      </button>
      <button
        type="button"
        onClick={openBoardSettings}
        aria-label="Board settings"
        title="Board settings"
        className="rounded text-text-faint transition hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <FaGear />
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
      <Link
        href="/board/map"
        aria-label="Move tree map"
        title="Move tree map"
        className="rounded text-text-faint transition hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <FaSitemap />
      </Link>
    </div>
  );
}
