"use client";

import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Chess, type PieceSymbol, type Square } from "chess.js";
import {
  Chessboard,
  chessColumnToColumnIndex,
  defaultDarkSquareStyle,
  defaultLightSquareStyle,
  defaultPieces,
} from "react-chessboard";
import type {
  PieceDropHandlerArgs,
  PieceRenderObject,
  SquareHandlerArgs,
} from "react-chessboard";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { PiArrowsDownUp } from "react-icons/pi";

export default function PlayVsRandom() {
  // Stable chess instance
  const chessGameRef = useRef<Chess>(new Chess());
  const chessGame = chessGameRef.current;

  // Position state (only for triggering re-renders)
  const [chessPosition, setChessPosition] = useState<string>(chessGame.fen());
  const [optionSquares, setOptionSquares] = useState<
    Record<string, React.CSSProperties>
  >({});
  const [moveFrom, setMoveFrom] = useState<string>("");
  const [orientation, setOrientation] = useState<"white" | "black">("white");
  const [isOpen, setIsOpen] = useState(true);
  const [winner, setWinner] = useState<"White" | "Black" | "Draw" | null>(null);

  useEffect(() => {
    if (!chessGame.isGameOver()) return;

    if (chessGame.isCheckmate()) {
      // side to move is checkmated
      const sideToMove = chessGame.turn(); // 'w' or 'b'
      setWinner(sideToMove === "w" ? "Black" : "White");
    } else {
      setWinner("Draw");
    }

    setIsOpen(true);
  }, [chessPosition]);

  // track the promotion move
  const [promotionMove, setPromotionMove] = useState<Omit<
    PieceDropHandlerArgs,
    "piece"
  > | null>(null);

  // measure square width for promotion dialog positioning
  const boardWrapRef = useRef<HTMLDivElement | null>(null);
  const [squareWidth, setSquareWidth] = useState(0);

  useLayoutEffect(() => {
    if (!boardWrapRef.current) return;

    const measure = () => {
      const el = boardWrapRef.current!.querySelector(
        `[data-column="a"][data-row="1"]`,
      ) as HTMLElement | null;

      if (el) setSquareWidth(el.getBoundingClientRect().width);
    };

    measure();

    const ro = new ResizeObserver(measure);
    ro.observe(boardWrapRef.current);

    return () => ro.disconnect();
  }, []);

  function makeRandomMove() {
    if (chessGame.isGameOver()) return;

    const possibleMoves = chessGame.moves();
    const randomMove =
      possibleMoves[Math.floor(Math.random() * possibleMoves.length)];

    chessGame.move(randomMove);
    setChessPosition(chessGame.fen());
  }

  // get the move options for a square to show valid moves
  function getMoveOptions(square: Square) {
    const moves = chessGame.moves({
      square,
      verbose: true,
    });

    if (moves.length === 0) {
      setOptionSquares({});
      return false;
    }

    const newSquares: Record<string, React.CSSProperties> = {};

    for (const move of moves) {
      newSquares[move.to] = {
        background:
          chessGame.get(move.to) &&
          chessGame.get(move.to)?.color !== chessGame.get(square)?.color
            ? "radial-gradient(circle, rgba(0,0,0,.1) 85%, transparent 85%)"
            : "radial-gradient(circle, rgba(0,0,0,.1) 25%, transparent 25%)",
        borderRadius: "50%",
      };
    }

    newSquares[square] = {
      background: "rgba(255, 255, 0, 0.4)",
    };

    setOptionSquares(newSquares);
    return true;
  }

  function onSquareClick({ square, piece }: SquareHandlerArgs) {
    // piece clicked to move
    if (!moveFrom && piece) {
      const hasMoveOptions = getMoveOptions(square as Square);
      if (hasMoveOptions) setMoveFrom(square);
      return;
    }

    // square clicked to move to, check if valid move
    const moves = chessGame.moves({
      square: moveFrom as Square,
      verbose: true,
    });
    const foundMove = moves.find((m) => m.from === moveFrom && m.to === square);

    // not a valid move
    if (!foundMove) {
      const hasMoveOptions = getMoveOptions(square as Square);
      setMoveFrom(hasMoveOptions ? square : "");
      return;
    }

    // normal move (click-to-move promotes to queen by default)
    try {
      chessGame.move({
        from: moveFrom,
        to: square,
        promotion: "q",
      });
    } catch {
      const hasMoveOptions = getMoveOptions(square as Square);
      if (hasMoveOptions) setMoveFrom(square);
      return;
    }

    setChessPosition(chessGame.fen());
    setTimeout(makeRandomMove, 300);
    setMoveFrom("");
    setOptionSquares({});
  }

  // handle piece drop (supports promotion dialog for both colors)
  function onPieceDrop({ sourceSquare, targetSquare }: PieceDropHandlerArgs) {
    if (!targetSquare) return false;

    const movingPiece = chessGame.get(sourceSquare as Square);

    const isBackRank =
      (movingPiece?.color === "w" && targetSquare.endsWith("8")) ||
      (movingPiece?.color === "b" && targetSquare.endsWith("1"));

    if (movingPiece?.type === "p" && isBackRank) {
      const possibleMoves = chessGame.moves({
        square: sourceSquare as Square,
        verbose: true,
      });

      const isPromotionMove = possibleMoves.some(
        (m) => m.to === targetSquare && m.promotion,
      );

      if (isPromotionMove) {
        setPromotionMove({ sourceSquare, targetSquare });
        return true; // prevent animation; we will commit after selection
      }
    }

    try {
      chessGame.move({
        from: sourceSquare,
        to: targetSquare,
      });

      setChessPosition(chessGame.fen());
      setMoveFrom("");
      setOptionSquares({});

      setTimeout(makeRandomMove, 500);
      return true;
    } catch {
      return false;
    }
  }

  // handle promotion piece select
  function onPromotionPieceSelect(piece: PieceSymbol) {
    try {
      chessGame.move({
        from: promotionMove!.sourceSquare,
        to: promotionMove!.targetSquare as Square,
        promotion: piece,
      });

      setChessPosition(chessGame.fen());
      setMoveFrom("");
      setOptionSquares({});

      setTimeout(makeRandomMove, 500);
    } catch {
      // do nothing
    }

    setPromotionMove(null);
  }

  const promotionFile = promotionMove?.targetSquare
    ? (promotionMove.targetSquare.match(/^[a-z]+/)?.[0] ?? "")
    : "";

  // calculate the left position of the promotion square (respect orientation)
  const promotionSquareLeft = promotionMove?.targetSquare
    ? squareWidth *
      chessColumnToColumnIndex(
        promotionFile,
        8, // number of columns
        orientation, // board orientation
      )
    : 0;

  // render correct-color pieces in the promotion selector
  const promoColor = promotionMove
    ? (chessGame.get(promotionMove.sourceSquare as Square)?.color ?? "w")
    : "w";

  const resetGame = () => {
    chessGame.reset();
    setChessPosition(chessGame.fen());
    setMoveFrom("");
    setOptionSquares({});
    setPromotionMove(null);
    setWinner(null);
    setIsOpen(false); // optional: close immediately on reset
  };

  const chessboardOptions = useMemo(
    () => ({
      id: "play-vs-random",
      position: chessPosition,
      onPieceDrop,
      onSquareClick,
      boardOrientation: orientation,
      squareStyles: optionSquares,
      darkSquareStyle: {
        ...defaultDarkSquareStyle,
        backgroundColor: "#769656",
      },
      lightSquareStyle: {
        ...defaultLightSquareStyle,
        backgroundColor: "#EEEED2",
      },
      boardStyle: {
        borderRadius: "4px",
      },
    }),
    [chessPosition, optionSquares, orientation],
  );

  return (
    <div className="flex justify-center items-center h-screen flex-col gap-4">
      <div className="flex flex-row justify-center gap-2">
        <button
          className="p-2 bg-blue-500 text-white rounded cursor-pointer"
          onClick={() => {
            chessGame.reset();
            setChessPosition(chessGame.fen());
            setMoveFrom("");
            setOptionSquares({});
            setPromotionMove(null);
          }}
        >
          New game
        </button>

        <button
          className="p-2 bg-blue-500 text-white rounded cursor-pointer"
          onClick={() =>
            setOrientation((o) => (o === "white" ? "black" : "white"))
          }
        >
          <PiArrowsDownUp size={20} />
        </button>

        <button
          className="p-2 bg-blue-500 text-white rounded cursor-pointer"
          onClick={() => {
            chessGame.undo();
            setChessPosition(chessGame.fen());
            setMoveFrom("");
            setOptionSquares({});
            setPromotionMove(null);
          }}
        >
          Take Back
        </button>
      </div>

      <div ref={boardWrapRef} className="w-125 h-125">
        <div style={{ position: "relative" }}>
          {promotionMove ? (
            <div
              onClick={() => setPromotionMove(null)}
              onContextMenu={(e) => {
                e.preventDefault();
                setPromotionMove(null);
              }}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: "rgba(0, 0, 0, 0.1)",
                zIndex: 1000,
              }}
            />
          ) : null}

          {promotionMove ? (
            <div
              style={{
                position: "absolute",
                top: 0,
                left: promotionSquareLeft,
                backgroundColor: "white",
                width: squareWidth,
                zIndex: 1001,
                display: "flex",
                flexDirection: "column",
                boxShadow: "0 0 10px 0 rgba(0, 0, 0, 0.5)",
              }}
            >
              {(["q", "r", "n", "b"] as PieceSymbol[]).map((piece) => (
                <button
                  key={piece}
                  onClick={() => onPromotionPieceSelect(piece)}
                  onContextMenu={(e) => e.preventDefault()}
                  style={{
                    width: "100%",
                    aspectRatio: "1",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 0,
                    border: "none",
                    cursor: "pointer",
                    background: "transparent",
                  }}
                >
                  {defaultPieces[
                    `${promoColor}${piece.toUpperCase()}` as keyof PieceRenderObject
                  ]()}
                </button>
              ))}
            </div>
          ) : null}

          <Chessboard options={chessboardOptions} />
        </div>
      </div>

      <Modal
        isOpen={(chessGame.isCheckmate() || chessGame.isDraw()) && isOpen}
        onClose={() => setIsOpen(false)}
      >
        <div className="flex flex-col justify-center items-center gap-4">
          <h2 className="font-bold text-black text-center text-2xl">
            {winner === "Draw" ? "Draw" : `${winner} Wins`}
          </h2>

          <div className="flex flex-row justify-center items-center gap-4">
            <Button
              label="Analyze"
              className="w-40 mx-auto text-sm"
              onClick={() => {
                setIsOpen(false);
                console.log("Analyze clicked");
              }}
            />

            <Button
              className="w-40 mx-auto text-sm"
              label={"New Game"}
              onClick={resetGame}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
