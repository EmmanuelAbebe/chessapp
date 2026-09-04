"use client";

import { useState } from "react";
import type { Orientation } from "../types";

export type GameMode = "analysis" | "vsStockfish";

export function useGameMode() {
  const [mode, setMode] = useState<GameMode>("analysis");
  const [playerSide, setPlayerSide] = useState<Orientation>("white");
  const [skillLevel, setSkillLevel] = useState(10);

  function startAnalysis() {
    setMode("analysis");
  }

  // The human's side is always whoever's actually to move in the position
  // the game starts from - a standard start means White, a custom setup
  // position can mean either - never a separate picker to keep in sync
  // with the FEN itself.
  function startVsStockfish(side: Orientation, nextSkillLevel: number) {
    setPlayerSide(side);
    setSkillLevel(nextSkillLevel);
    setMode("vsStockfish");

    return side;
  }

  return {
    mode,
    playerSide,
    skillLevel,
    startAnalysis,
    startVsStockfish,
  };
}
