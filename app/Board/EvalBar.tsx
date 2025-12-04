// components/chess/EvalBar.tsx
"use client";

import type { Color } from "./types";
import type { EngineEval } from "../../hooks/useStockfishEngine";

type EvalBarProps = {
  evaluation: EngineEval | null;
  sideToMove: Color;
};

export function EvalBar({ evaluation, sideToMove }: EvalBarProps) {
  // Convert engine score (side-to-move POV) into "white advantage in pawns"
  let whiteAdvantagePawns = 0;

  if (evaluation) {
    if (evaluation.type === "cp") {
      const pawns = evaluation.value / 100;
      whiteAdvantagePawns = sideToMove === "white" ? pawns : -pawns;
    } else if (evaluation.type === "mate") {
      const sign = evaluation.value > 0 ? 1 : -1; // side to move winning/losing
      const huge = 10 * sign; // treat mate as ±10 pawns
      whiteAdvantagePawns = sideToMove === "white" ? huge : -huge;
    }
  }

  // Clamp [-10, 10] -> [0, 100] white%
  const clamped = Math.max(-10, Math.min(10, whiteAdvantagePawns));
  const whitePct = 50 + clamped * 5; // -10 -> 0, 0 -> 50, +10 -> 100

  const displayText = (() => {
    if (!evaluation) return "0.00";

    if (evaluation.type === "cp") {
      const pawns = Math.abs(evaluation.value / 100);
      return pawns.toFixed(2);
    }

    const mateIn = Math.abs(evaluation.value);
    return `M${mateIn}`;
  })();

  const whiteWinningOrEqual = whiteAdvantagePawns >= 0;

  return (
    <div className="flex flex-col items-center h-full select-none">
      <div className="w-3 sm:w-8 h-full bg-neutral-800 overflow-hidden flex flex-col-reverse shadow border-neutral-700">
        {/* White portion */}
        <div
          style={{ height: `${whitePct}%` }}
          className="bg-white flex flex-col"
        >
          {whiteWinningOrEqual && (
            <p className="mt-auto w-full text-center text-[10px] font-mono text-neutral-800">
              {displayText}
            </p>
          )}
        </div>

        {/* Black portion */}
        <div
          style={{ height: `${100 - whitePct}%` }}
          className="bg-black flex flex-col"
        >
          {!whiteWinningOrEqual && (
            <p className="mb-auto w-full text-center text-[10px] font-mono text-neutral-200">
              {displayText}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
