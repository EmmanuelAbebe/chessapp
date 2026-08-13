"use client";

import React from "react";
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

  return (
    <div className="w-130 rounded bg-neutral-900 p-3 text-white">
      <div className="flex justify-start overflow-x-auto no-scrollbar">
        <div className="flex w-max flex-row gap-1 text-sm whitespace-nowrap">
          {movePairs.map((pair) => (
            <div
              key={pair.moveNumber}
              className="flex shrink-0 flex-row items-center"
            >
              <span className="text-neutral-400">{pair.moveNumber}.</span>

              <button
                type="button"
                className={`shrink-0 rounded px-2 py-1 whitespace-nowrap hover:bg-neutral-800 ${
                  currentNodeId === pair.white?.id ? "bg-neutral-700" : ""
                }`}
                onClick={() => pair.white && onSelectNode(pair.white.id)}
              >
                {pair.white?.san ?? ""}
              </button>

              <button
                type="button"
                className={`shrink-0 rounded px-2 py-1 whitespace-nowrap hover:bg-neutral-800 ${
                  currentNodeId === pair.black?.id ? "bg-neutral-700" : ""
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
