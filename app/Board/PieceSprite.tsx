"use client";

import { memo } from "react";
import { pieceIcons } from "./PieceIcons";

interface Props {
  id: number;
  type: string;
  row: number;
  col: number;
  size: number;
  dragging: boolean;
  x: number;
  y: number;
  onMouseDown: (e: React.MouseEvent) => void;
}

const PieceSprite = memo(function PieceSprite({
  type,
  row,
  col,
  size,
  dragging,
  x,
  y,
  onMouseDown,
}: Props) {
  const style = dragging
    ? {
        transform: `translate(${x - size / 2}px, ${y - size / 2}px)`,
      }
    : {
        transform: `translate(${col * size}px, ${row * size}px)`,
      };

  return (
    <div
      className="absolute pointer-events-auto"
      style={{ width: size, height: size, ...style }}
      onMouseDown={onMouseDown}
    >
      {pieceIcons[type]}
    </div>
  );
});

export default PieceSprite;
