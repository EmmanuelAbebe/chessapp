import type { ReactNode } from "react";
import { BoardGameProvider } from "@/features/board/BoardGameContext";

export default function GameLayout({ children }: { children: ReactNode }) {
  return <BoardGameProvider>{children}</BoardGameProvider>;
}
