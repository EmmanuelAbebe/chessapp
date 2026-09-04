import { Chess } from "chess.js";
import type { MoveNode, MoveTreeState } from "../types";

function createNodeId() {
  return `node_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createMoveTree(startFen?: string): MoveTreeState {
  const initialFen = startFen ?? new Chess().fen();

  const rootNode: MoveNode = {
    id: "root",
    parentId: null,
    children: [],
    san: null,
    uci: null,
    fen: initialFen,
    ply: 0,
    moveNumber: 0,
    side: null,
  };

  return {
    rootId: rootNode.id,
    currentNodeId: rootNode.id,
    nodes: {
      [rootNode.id]: rootNode,
    },
  };
}

export function getNode(tree: MoveTreeState, nodeId: string) {
  return tree.nodes[nodeId];
}

export function getCurrentNode(tree: MoveTreeState) {
  return tree.nodes[tree.currentNodeId];
}

export function getPathToNode(tree: MoveTreeState, nodeId: string): MoveNode[] {
  const path: MoveNode[] = [];
  let cursor: string | null = nodeId;

  while (cursor) {
    const node: MoveNode = tree.nodes[cursor];
    path.push(node);
    cursor = node.parentId;
  }

  return path.reverse();
}

export function findChildByUci(
  tree: MoveTreeState,
  parentId: string,
  uci: string,
): string | null {
  const parent = tree.nodes[parentId];

  for (const childId of parent.children) {
    if (tree.nodes[childId]?.uci === uci) {
      return childId;
    }
  }

  return null;
}

export function appendChildNode(
  tree: MoveTreeState,
  parentId: string,
  data: {
    san: string;
    uci: string;
    fen: string;
    side: "w" | "b";
    comment?: string;
  },
): MoveTreeState {
  const parent = tree.nodes[parentId];
  const nextPly = parent.ply + 1;

  const child: MoveNode = {
    id: createNodeId(),
    parentId,
    children: [],
    san: data.san,
    uci: data.uci,
    fen: data.fen,
    ply: nextPly,
    moveNumber: Math.floor((nextPly + 1) / 2),
    side: data.side,
    comment: data.comment,
  };

  return {
    ...tree,
    currentNodeId: child.id,
    nodes: {
      ...tree.nodes,
      [parentId]: {
        ...parent,
        children: [...parent.children, child.id],
      },
      [child.id]: child,
    },
  };
}

export function getFirstChildId(
  tree: MoveTreeState,
  nodeId: string,
): string | null {
  return tree.nodes[nodeId]?.children[0] ?? null;
}

export function getLastNodeInMainLine(
  tree: MoveTreeState,
  startNodeId: string,
): string {
  let cursor = startNodeId;

  while (tree.nodes[cursor].children.length > 0) {
    cursor = tree.nodes[cursor].children[0];
  }

  return cursor;
}

export function getSiblingIds(tree: MoveTreeState, nodeId: string): string[] {
  const node = tree.nodes[nodeId];

  if (!node.parentId) return [];

  return tree.nodes[node.parentId].children;
}

export function getVariationIndex(tree: MoveTreeState, nodeId: string): number {
  const siblings = getSiblingIds(tree, nodeId);
  return siblings.findIndex((id) => id === nodeId);
}
