"use client";

import { useMemo, useState } from "react";
import { Chess, type Square } from "chess.js";
import type { MoveNode, MoveTreeState } from "../types";
import {
  appendChildNode,
  createMoveTree,
  findChildByUci,
  getCurrentNode,
  getFirstChildId,
  getLastNodeInMainLine,
  getPathToNode,
  getSiblingIds,
  getVariationIndex,
} from "../lib/move-tree";

type PlayMoveInput = {
  from: string;
  to: string;
  promotion?: string;
};

function applyMove(
  tree: MoveTreeState,
  parentId: string,
  input: PlayMoveInput,
): { tree: MoveTreeState; nodeId: string } | null {
  const parent = tree.nodes[parentId];
  const chess = new Chess(parent.fen);

  const move = chess.move({
    from: input.from as Square,
    to: input.to as Square,
    promotion: input.promotion as "q" | "r" | "b" | "n" | undefined,
  });

  if (!move) return null;

  const uci = `${move.from}${move.to}${move.promotion ?? ""}`;
  const existingChildId = findChildByUci(tree, parentId, uci);

  if (existingChildId) {
    return { tree, nodeId: existingChildId };
  }

  const nextTree = appendChildNode(tree, parentId, {
    san: move.san,
    uci,
    fen: chess.fen(),
    side: move.color,
  });

  return { tree: nextTree, nodeId: nextTree.currentNodeId };
}

export function useMoveTree() {
  const [tree, setTree] = useState(() => createMoveTree());

  const currentNode = useMemo(() => getCurrentNode(tree), [tree]);
  const currentFen = currentNode.fen;

  const currentBranchEndId = useMemo(
    () => getLastNodeInMainLine(tree, tree.currentNodeId),
    [tree],
  );

  const currentLine = useMemo(
    () =>
      getPathToNode(tree, currentBranchEndId).filter(
        (node) => node.parentId !== null,
      ),
    [tree, currentBranchEndId],
  );

  const currentChildren = useMemo(
    () => currentNode.children.map((childId) => tree.nodes[childId]),
    [currentNode.children, tree.nodes],
  );

  const siblingIds = useMemo(
    () => getSiblingIds(tree, tree.currentNodeId),
    [tree],
  );

  const variationIndex = useMemo(
    () =>
      tree.currentNodeId === tree.rootId
        ? -1
        : getVariationIndex(tree, tree.currentNodeId),
    [tree],
  );

  function resetTree(startFen?: string) {
    setTree(createMoveTree(startFen));
  }

  function goToNode(nodeId: string) {
    if (!tree.nodes[nodeId]) return;
    setTree((prev) => ({
      ...prev,
      currentNodeId: nodeId,
    }));
  }

  function goToStart() {
    setTree((prev) => ({
      ...prev,
      currentNodeId: prev.rootId,
    }));
  }

  function goToPrevious() {
    const parentId = currentNode.parentId;
    if (!parentId) return;

    setTree((prev) => ({
      ...prev,
      currentNodeId: parentId,
    }));
  }

  // "Undo" takes back a full move - both plies of a turn, yours and (if
  // already played) the reply - not just the single ply its own icon
  // might suggest; a player asking to undo their move usually means
  // "let me try something else here," which a single ply back doesn't
  // give them while the opponent's reply is still sitting there. Falls
  // back to one ply at the very start of a line, where a second ply back
  // doesn't exist yet.
  function undoMove() {
    const parentId = currentNode.parentId;
    if (!parentId) return;

    const grandparentId = tree.nodes[parentId]?.parentId ?? parentId;

    setTree((prev) => ({
      ...prev,
      currentNodeId: grandparentId,
    }));
  }

  function goToNext() {
    const nextChildId = getFirstChildId(tree, tree.currentNodeId);
    if (!nextChildId) return;

    setTree((prev) => ({
      ...prev,
      currentNodeId: nextChildId,
    }));
  }

  function goToEnd() {
    const leafId = getLastNodeInMainLine(tree, tree.currentNodeId);

    setTree((prev) => ({
      ...prev,
      currentNodeId: leafId,
    }));
  }

  function goToPreviousVariation() {
    if (currentNode.parentId === null) return;
    if (variationIndex <= 0) return;

    const nextNodeId = siblingIds[variationIndex - 1];
    if (!nextNodeId) return;

    setTree((prev) => ({
      ...prev,
      currentNodeId: nextNodeId,
    }));
  }

  function goToNextVariation() {
    if (currentNode.parentId === null) return;
    if (variationIndex < 0 || variationIndex >= siblingIds.length - 1) return;

    const nextNodeId = siblingIds[variationIndex + 1];
    if (!nextNodeId) return;

    setTree((prev) => ({
      ...prev,
      currentNodeId: nextNodeId,
    }));
  }

  function playMove(input: PlayMoveInput) {
    return playMoveAt(tree.currentNodeId, input);
  }

  // Plays a move from an arbitrary node, not just the current one - lets a
  // sideline be explored (e.g. from the move-tree map's preview board)
  // without first navigating there. The played move still becomes the new
  // current node, same as playing directly on the main board.
  function playMoveAt(nodeId: string, input: PlayMoveInput) {
    let resultNodeId: string | null = null;

    setTree((prev) => {
      const result = applyMove(prev, nodeId, input);
      if (!result) return prev;
      resultNodeId = result.nodeId;
      return { ...result.tree, currentNodeId: result.nodeId };
    });

    return resultNodeId;
  }

  return {
    tree,
    currentNode,
    currentFen,
    currentLine,
    currentChildren,
    currentNodeId: tree.currentNodeId,

    canGoPrevious: currentNode.parentId !== null,
    canGoNext: currentNode.children.length > 0,
    canGoEnd: currentNode.children.length > 0,
    canGoPreviousVariation: currentNode.parentId !== null && variationIndex > 0,
    canGoNextVariation:
      currentNode.parentId !== null && variationIndex < siblingIds.length - 1,

    resetTree,
    playMove,
    playMoveAt,
    goToNode,
    goToStart,
    goToPrevious,
    undoMove,
    goToNext,
    goToEnd,
    goToPreviousVariation,
    goToNextVariation,
  };
}
