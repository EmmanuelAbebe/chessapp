"use client";

import { useState } from "react";

export function useBoardPreferences() {
  const [engineDepth, setEngineDepth] = useState(14);
  const [engineMoveTime, setEngineMoveTime] = useState(300);
  const [showEvalBar, setShowEvalBar] = useState(false);

  return {
    engineDepth,
    setEngineDepth,
    engineMoveTime,
    setEngineMoveTime,
    showEvalBar,
    setShowEvalBar,
  };
}
