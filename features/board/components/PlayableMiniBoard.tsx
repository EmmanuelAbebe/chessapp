"use client";

import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { Chessboard } from "react-chessboard";
import type { Arrow, SquareHandlerArgs } from "react-chessboard";
import { Chess, type Square } from "chess.js";
import { useBoardGameContext } from "../BoardGameContext";
import { getMoveOptions } from "../lib/board-helpers";
import { boardTheme } from "../lib/board-theme";
import { readThemeColors } from "../lib/move-tree-map-helpers";
import type { MoveNode, MoveTreeState, OptionSquares } from "../types";

// A real, playable board for the previewed node - lets a sideline be tried
// out right from the map without first jumping the whole game there. Moves
// play via click-to-move (same interaction as the main board) and land as a
// new branch off `node` via `playMoveAt`; `onMove` reports the resulting
// node id so the caller can keep the preview card pointed at it.
export function PlayableMiniBoard({
  node,
  tree,
  animateEntry,
  onMove,
}: {
  node: MoveNode;
  tree: MoveTreeState;
  animateEntry: boolean;
  onMove: (nodeId: string) => void;
}) {
  const { playMoveAt } = useBoardGameContext();
  const [moveFrom, setMoveFrom] = useState("");
  const [optionSquares, setOptionSquares] = useState<OptionSquares>({});
  // Read after mount rather than in a lazy initializer - the card now
  // renders by default (not just on hover/pin), including during SSR/build
  // prerendering where `document` doesn't exist. A raw SVG stroke attribute
  // (unlike a CSS property) won't resolve a `var(--accent)` reference
  // either, so the resolved color still has to come from the DOM once
  // there is one.
  const [accentColor, setAccentColor] = useState("#5b9dfa");
  useEffect(() => {
    setAccentColor(readThemeColors().accent);
  }, []);

  // What the board actually displays, plus whether the *next* position
  // update should animate - lets a click on any node (however far from
  // whatever was on screen before) always play as one clean single-move
  // slide: snap instantly to the position just before that move, then
  // animate forward into it, rather than animating a jump between two
  // unrelated positions (or not animating at all).
  const [displayFen, setDisplayFen] = useState(node.fen);
  const [animateNow, setAnimateNow] = useState(false);

  // Runs before paint so the "snap to the pre-move position" step is never
  // itself visible as a flash of the wrong position.
  useLayoutEffect(() => {
    setMoveFrom("");
    setOptionSquares({});

    const parent = node.parentId ? tree.nodes[node.parentId] : null;
    setAnimateNow(false);
    setDisplayFen(animateEntry && parent ? parent.fen : node.fen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.id]);

  // One tick later (after the snap above has actually painted) transition
  // to the real position with animation turned on, so react-chessboard has
  // a "before" frame to diff against instead of collapsing both updates
  // into a single unanimated jump.
  useEffect(() => {
    const parent = node.parentId ? tree.nodes[node.parentId] : null;
    if (!animateEntry || !parent) return;
    const raf = requestAnimationFrame(() => {
      setAnimateNow(true);
      setDisplayFen(node.fen);
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.id]);

  const chess = useMemo(() => new Chess(node.fen), [node.fen]);

  // Which move got here, shown the same way the main board does it (a tinted
  // background on the from/to squares) instead of as a text label - reads at
  // a glance without taking up any of the card's own layout.
  const lastMoveSquares = useMemo<OptionSquares>(() => {
    if (!node.uci) return {};
    const from = node.uci.slice(0, 2);
    const to = node.uci.slice(2, 4);
    const highlight = { backgroundColor: "rgba(255, 170, 0, 0.3)" };
    return { [from]: highlight, [to]: highlight };
  }, [node.uci]);

  // Every move already explored from this position - shown as arrows so
  // "moving forward" needs no dedicated control: it's just clicking a move
  // that already has a visible destination, same as playing a brand new one.
  const exploredArrows = useMemo<Arrow[]>(() => {
    return node.children
      .map((childId) => tree.nodes[childId]?.uci)
      .filter((uci): uci is string => !!uci)
      .map((uci) => ({
        startSquare: uci.slice(0, 2),
        endSquare: uci.slice(2, 4),
        color: accentColor,
      }));
  }, [node.children, tree.nodes, accentColor]);

  function onSquareClick({ square, piece }: SquareHandlerArgs) {
    if (chess.isGameOver()) return;

    if (!moveFrom && piece) {
      const nextOptions = getMoveOptions(chess, square as Square);
      setOptionSquares(nextOptions ?? {});
      if (nextOptions) setMoveFrom(square);
      return;
    }

    const moves = chess.moves({ square: moveFrom as Square, verbose: true });
    const foundMove = moves.find((m) => m.from === moveFrom && m.to === square);

    if (!foundMove) {
      const nextOptions = getMoveOptions(chess, square as Square);
      setOptionSquares(nextOptions ?? {});
      setMoveFrom(nextOptions ? square : "");
      return;
    }

    const resultId = playMoveAt(node.id, {
      from: moveFrom,
      to: square,
      promotion: "q",
    });
    if (resultId) onMove(resultId);
    setMoveFrom("");
    setOptionSquares({});
  }

  const options = useMemo(
    () => ({
      id: "move-tree-preview-board",
      position: displayFen,
      onSquareClick,
      squareStyles: { ...lastMoveSquares, ...optionSquares },
      allowDragging: false,
      allowDrawingArrows: false,
      arrows: exploredArrows,
      showAnimations: animateNow,
      animationDurationInMs: 280,
      showNotation: false,
      darkSquareStyle: boardTheme.darkSquareStyle,
      lightSquareStyle: boardTheme.lightSquareStyle,
      boardStyle: boardTheme.boardStyle,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [displayFen, animateNow, optionSquares, lastMoveSquares, moveFrom, exploredArrows],
  );

  return (
    <div className="aspect-square w-full overflow-hidden rounded-md border border-border-soft">
      <Chessboard options={options} />
    </div>
  );
}
