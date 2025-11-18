// LegalMoveGenerator.tsx
import React, { useMemo, useEffect } from "react";
import { generatePseudoMoves, makeMove, kingInCheck } from "./pseudoMoves";
import { Board, Color, CastlingRights, Square, Move } from "./types";

interface LegalMoveGeneratorProps {
  board: Board;
  sideToMove: Color;
  castling: CastlingRights;
  enPassantTarget: Square | null;
  onLegalMovesGenerated?: (moves: Move[]) => void;
}

/**
 * Utility/diagnostic component to list all legal moves
 * for the current side and board.
 */
const LegalMoveGenerator: React.FC<LegalMoveGeneratorProps> = ({
  board,
  sideToMove,
  castling,
  enPassantTarget,
  onLegalMovesGenerated,
}) => {
  const legalMoves = useMemo(() => {
    const moves: Move[] = [];

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (!piece) continue;
        const color = piece === piece.toLowerCase() ? "black" : "white";
        if (color !== sideToMove) continue;

        const pseudo = generatePseudoMoves(
          board,
          { row: r, col: c },
          sideToMove,
          castling,
          enPassantTarget
        );

        for (const m of pseudo) {
          const newBoard = makeMove(board, m);
          if (!kingInCheck(newBoard, sideToMove)) {
            moves.push(m);
          }
        }
      }
    }

    return moves;
  }, [board, sideToMove, castling, enPassantTarget]);

  useEffect(() => {
    if (onLegalMovesGenerated) onLegalMovesGenerated(legalMoves);
  }, [legalMoves, onLegalMovesGenerated]);

  return (
    <div className="text-sm">
      <h3 className="font-semibold mb-2">Legal moves for {sideToMove}</h3>
      <ul className="space-y-1 max-h-64 overflow-auto text-xs">
        {legalMoves.map((m, idx) => (
          <li key={idx}>
            From ({m.from.row}, {m.from.col}) → To ({m.to.row}, {m.to.col})
            {m.promotion ? ` promotion=${m.promotion}` : ""}
            {m.castling ? ` castling=${m.castling}` : ""}
            {m.enPassant ? " en-passant" : ""}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default LegalMoveGenerator;
