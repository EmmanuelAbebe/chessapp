"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { MoveNode } from "../types";

type MoveListProps = {
  currentLine: MoveNode[];
  currentNodeId: string;
  onSelectNode: (nodeId: string) => void;
  onSelectStart: () => void;
};

type MovePair = {
  moveNumber: number;
  white?: MoveNode;
  black?: MoveNode;
};

type HighlightRect = {
  left: number;
  width: number;
};

function buildMovePairs(currentLine: MoveNode[]): MovePair[] {
  const pairs: MovePair[] = [];

  for (const node of currentLine) {
    const lastPair = pairs[pairs.length - 1];

    if (node.side === "w") {
      pairs.push({
        moveNumber: node.moveNumber,
        white: node,
      });
      continue;
    }

    if (
      lastPair &&
      lastPair.moveNumber === node.moveNumber &&
      !lastPair.black
    ) {
      lastPair.black = node;
      continue;
    }

    pairs.push({
      moveNumber: node.moveNumber,
      black: node,
    });
  }

  return pairs;
}

export function MoveList({
  currentLine,
  currentNodeId,
  onSelectNode,
  onSelectStart,
}: MoveListProps) {
  const movePairs = buildMovePairs(currentLine);
  const currentMoveRef = useRef<HTMLButtonElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [highlight, setHighlight] = useState<HighlightRect | null>(null);

  const hasActiveMove = currentLine.some((node) => node.id === currentNodeId);

  useLayoutEffect(() => {
    if (!hasActiveMove) {
      setHighlight(null);
      return;
    }

    const button = currentMoveRef.current;
    setHighlight(
      button ? { left: button.offsetLeft, width: button.offsetWidth } : null,
    );
  }, [currentNodeId, currentLine, hasActiveMove]);

  useEffect(() => {
    const button = currentMoveRef.current;
    if (button) {
      button.scrollIntoView({
        inline: "nearest",
        block: "nearest",
        behavior: "smooth",
      });
    } else {
      // No move selected (e.g. jumped to the start) - scroll back to the beginning.
      containerRef.current?.scrollTo({ left: 0, behavior: "smooth" });
    }
  }, [currentNodeId]);

  return (
    <div className="w-full">
      <div ref={containerRef} className="flex justify-start overflow-x-auto no-scrollbar">
        <div className="relative flex w-max flex-row gap-1 text-sm whitespace-nowrap">
          {highlight && (
            <div
              aria-hidden="true"
              className="absolute inset-y-0 z-0 rounded bg-blue-500/15 transition-[left,width] duration-500 ease-out"
              style={{ left: highlight.left, width: highlight.width }}
            />
          )}

          {movePairs.map((pair) => (
            <div
              key={pair.moveNumber}
              className="flex shrink-0 flex-row items-center"
            >
              <span className="text-neutral-500">{pair.moveNumber}.</span>

              <button
                type="button"
                ref={currentNodeId === pair.white?.id ? currentMoveRef : undefined}
                className={`relative z-10 shrink-0 rounded px-2 py-1 whitespace-nowrap hover:bg-neutral-800 ${
                  currentNodeId === pair.white?.id
                    ? "font-medium text-blue-400"
                    : "text-neutral-300"
                }`}
                onClick={() => pair.white && onSelectNode(pair.white.id)}
              >
                {pair.white?.san ?? ""}
              </button>

              <button
                type="button"
                ref={currentNodeId === pair.black?.id ? currentMoveRef : undefined}
                className={`relative z-10 shrink-0 rounded px-2 py-1 whitespace-nowrap hover:bg-neutral-800 ${
                  currentNodeId === pair.black?.id
                    ? "font-medium text-blue-400"
                    : "text-neutral-300"
                }`}
                onClick={() => pair.black && onSelectNode(pair.black.id)}
              >
                {pair.black?.san ?? ""}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
