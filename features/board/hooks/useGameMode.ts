"use client";

import { useState } from "react";
import type { Orientation } from "../types";

export type GameMode = "analysis" | "vsStockfish";
export type SideChoice = Orientation | "random";

export function useGameMode() {
  const [mode, setMode] = useState<GameMode>("analysis");
  const [playerSide, setPlayerSide] = useState<Orientation>("white");
  const [skillLevel, setSkillLevel] = useState(10);

  function startAnalysis() {
    setMode("analysis");
  }

  function startVsStockfish(side: SideChoice, nextSkillLevel: number) {
    const resolvedSide: Orientation =
      side === "random" ? (Math.random() < 0.5 ? "white" : "black") : side;

    setPlayerSide(resolvedSide);
    setSkillLevel(nextSkillLevel);
    setMode("vsStockfish");

    return resolvedSide;
  }

  return {
    mode,
    playerSide,
    skillLevel,
    startAnalysis,
    startVsStockfish,
  };
}
