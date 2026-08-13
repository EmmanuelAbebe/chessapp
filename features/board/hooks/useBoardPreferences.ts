"use client";

import { useState } from "react";

export function useBoardPreferences() {
  const [engineDepth, setEngineDepth] = useState(14);
  const [engineMoveTime, setEngineMoveTime] = useState(300);
  const [showChat, setShowChat] = useState(true);
  const [showEvalBar, setShowEvalBar] = useState(true);

  return {
    engineDepth,
    setEngineDepth,
    engineMoveTime,
    setEngineMoveTime,
    showChat,
    setShowChat,
    showEvalBar,
    setShowEvalBar,
  };
}
