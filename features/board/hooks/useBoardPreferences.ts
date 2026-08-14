"use client";

import { useState } from "react";
import type { CoordinatesPlacement } from "../types";

export function useBoardPreferences() {
  const [engineDepth, setEngineDepth] = useState(14);
  const [engineMoveTime, setEngineMoveTime] = useState(300);
  const [showEvalBar, setShowEvalBar] = useState(false);
  const [showEvalScore, setShowEvalScore] = useState(true);
  const [showCoordinates, setShowCoordinates] = useState(true);
  const [coordinatesPlacement, setCoordinatesPlacement] =
    useState<CoordinatesPlacement>("inside");

  return {
    engineDepth,
    setEngineDepth,
    engineMoveTime,
    setEngineMoveTime,
    showEvalBar,
    setShowEvalBar,
    showEvalScore,
    setShowEvalScore,
    showCoordinates,
    setShowCoordinates,
    coordinatesPlacement,
    setCoordinatesPlacement,
  };
}
