"use client";

import { useState } from "react";

export function useBoardSettings() {
  const [isBoardSettingsOpen, setOpenBoardSettings] = useState(false);

  return {
    isBoardSettingsOpen,
    openBoardSettings: () => setOpenBoardSettings(true),
    closeBoardSettings: () => setOpenBoardSettings(false),
  };
}
