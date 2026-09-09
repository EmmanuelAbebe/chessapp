"use client";

import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { useBoardGame } from "./hooks/useBoardGame";
import { treeFromMoves } from "./lib/pgn-import";
import { takeExploreGame } from "@/features/history/exploreGame";

type BoardGameContextValue = ReturnType<typeof useBoardGame>;

const BoardGameContext = createContext<BoardGameContextValue | null>(null);

export function BoardGameProvider({ children }: { children: ReactNode }) {
  const boardGame = useBoardGame();
  const ref = useRef(boardGame);
  ref.current = boardGame;

  // A game sent over from the Statistics page's "explore on board / map"
  // (it can't reach this context directly). Picked up once, on entering
  // the (game) route group.
  useEffect(() => {
    const payload = takeExploreGame();
    if (!payload || payload.moves.length === 0) return;
    ref.current.startAnalysis();
    ref.current.loadTree(treeFromMoves(payload.moves));
    ref.current.changeOrientation(payload.playerSide === "b" ? "black" : "white");
  }, []);

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
