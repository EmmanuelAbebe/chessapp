"use client";

import React from "react";
import { FaGear } from "react-icons/fa6";
import { HiSwitchVertical } from "react-icons/hi";

type BoardControlsProps = {
  toggleOrientation: () => void;
  openBoardSettings: () => void;
};

export function BoardControls({
  toggleOrientation,
  openBoardSettings,
}: BoardControlsProps) {
  return (
    <div className="flex shrink-0 flex-col items-center gap-3 p-2">
      <FaGear
        className="cursor-pointer text-neutral-500 hover:text-neutral-300"
        onClick={openBoardSettings}
      />
      <HiSwitchVertical
        className="cursor-pointer text-neutral-500 hover:text-neutral-300"
        onClick={toggleOrientation}
      />
    </div>
  );
}
