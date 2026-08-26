"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useBoardGame } from "./hooks/useBoardGame";

type BoardGameContextValue = ReturnType<typeof useBoardGame>;

const BoardGameContext = createContext<BoardGameContextValue | null>(null);

export function BoardGameProvider({ children }: { children: ReactNode }) {
  const boardGame = useBoardGame();

  return (
    <BoardGameContext.Provider value={boardGame}>
      {children}
    </BoardGameContext.Provider>
  );
}

export function useBoardGameContext() {
  const ctx = useContext(BoardGameContext);
  if (!ctx) {
    throw new Error(
      "useBoardGameContext must be used within a BoardGameProvider",
    );
  }
  return ctx;
}
