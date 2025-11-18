"use client";

import { memo } from "react";
import { highlightStyles, SquareProps } from "./types";

const Square = memo(({ row, col, highlights = [], onClick }: SquareProps) => {
  const isDark = (row + col) % 2 === 1;

  return (
    <div
      onClick={() => onClick?.(row, col)}
      className={`relative aspect-square overflow-visible hover:border-2 border-white ${
        isDark ? "bg-[#E6CBA8]" : "bg-[#A47148]"
      }`}
    >
      {/* stacked highlight layers */}
      {highlights.map((h, i) => (
        <div
          key={i}
          className={`absolute inset-0 pointer-events-none ${highlightStyles[h]}`}
        />
      ))}
    </div>
  );
});

export default Square;
