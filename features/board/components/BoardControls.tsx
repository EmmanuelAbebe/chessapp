"use client";

import React from "react";
import { FaGear } from "react-icons/fa6";
import { HiSwitchVertical } from "react-icons/hi";
import type { Orientation } from "../types";

type BoardControlsProps = {
  toggleOrientation: React.Dispatch<React.SetStateAction<Orientation>>;
  openBoardSettings: () => void;
};

export function BoardControls({
  toggleOrientation,
  openBoardSettings,
}: BoardControlsProps) {
  return (
    <div className="w-5 flex flex-col gap-3 p-2 justify-start items-center">
      <FaGear
        className="cursor-pointer text-gray-400/80 hover:text-gray-300"
        onClick={openBoardSettings}
      />
      <HiSwitchVertical
        className="cursor-pointer text-gray-400/80 hover:text-gray-300"
        onClick={() =>
          toggleOrientation((o) => (o === "white" ? "black" : "white"))
        }
      />
    </div>
  );
}
