"use client";
import { useState } from "react";
import { Arrow, Position } from "./types";

interface ArrowsProps {
  boardRef: React.RefObject<HTMLDivElement | null>;
}

export default function Arrows({ boardRef }: ArrowsProps) {
  const [arrows, setArrows] = useState<Arrow[]>([]);
  const [arrowStart, setArrowStart] = useState<Position | null>(null);
  const [hoverSquare, setHoverSquare] = useState<Position | null>(null);

  // Right-click handler (Board will call this)
  const handleRightClick = (row: number, col: number) => {
    // Remove arrow if clicking on endpoint
    const index = arrows.findIndex(
      (a) =>
        (a.from.r === row && a.from.c === col) ||
        (a.to.r === row && a.to.c === col)
    );

    if (index >= 0) {
      setArrows((prev) => prev.filter((_, i) => i !== index));
      setArrowStart(null);
      setHoverSquare(null);
      return;
    }

    // Start new arrow
    if (!arrowStart) {
      setArrowStart({ r: row, c: col });
      return;
    }

    // Complete arrow
    setArrows((prev) => [
      ...prev,
      { from: arrowStart, to: { r: row, c: col } },
    ]);
    setArrowStart(null);
    setHoverSquare(null);
  };

  const size = boardRef.current?.clientWidth
    ? boardRef.current.clientWidth / 8
    : 0;

  return (
    <div className="absolute inset-0 pointer-events-none">
      <svg className="w-full h-full">
        {/* Render finished arrows */}
        {arrows.map((arrow, i) => {
          const fromX = arrow.from.c * size + size / 2;
          const fromY = arrow.from.r * size + size / 2;
          const toX = arrow.to.c * size + size / 2;
          const toY = arrow.to.r * size + size / 2;

          return (
            <line
              key={i}
              x1={fromX}
              y1={fromY}
              x2={toX}
              y2={toY}
              stroke="red"
              strokeWidth={3}
              markerEnd="url(#arrowhead)"
            />
          );
        })}

        {/* Live preview */}
        {arrowStart && hoverSquare && (
          <line
            x1={arrowStart.c * size + size / 2}
            y1={arrowStart.r * size + size / 2}
            x2={hoverSquare.c * size + size / 2}
            y2={hoverSquare.r * size + size / 2}
            stroke="red"
            strokeWidth={3}
            strokeDasharray="6"
            markerEnd="url(#arrowhead)"
          />
        )}

        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="0"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="red" />
          </marker>
        </defs>
      </svg>
    </div>
  );
}
