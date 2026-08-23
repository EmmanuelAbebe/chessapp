import type {} from "react/canary";
import { ViewTransition } from "react";
import { BoardScreen } from "@/features/board/components/BoardScreen";

export default function BoardPage() {
  return (
    <ViewTransition enter="nav-forward" exit="nav-forward" default="none">
      <BoardScreen />
    </ViewTransition>
  );
}
