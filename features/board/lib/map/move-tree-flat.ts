import type { MoveTreeState } from "../../types";
import { nodeLabel } from "./move-tree-map-helpers";

// A flat, index-addressed view of a MoveTreeState, built once per tree
// change. The canvas draw loop and the visible-set walk (see
// collectVisibleNodes in move-tree-visible-set.ts) address nodes by a
// dense integer index instead of a string id + object-property lookup - so
// the hot paths touch typed arrays, never `tree.nodes[id]` / `for..in` / a
// freshly-allocated Map per frame.
//
// Topology is stored CSR-style: `childStart[i]..childStart[i+1]` is the
// slice of `childIdx` holding node i's children. `parent[i]` is -1 for the
// root (and for any node whose parentId doesn't resolve - shouldn't
// happen, but the walk must not deref a bad index).

export type FlatTree = {
  n: number;
  /** index -> node id */
  ids: string[];
  idToIdx: Map<string, number>;
  /** index -> parent index, -1 for the root */
  parent: Int32Array;
  /** CSR offsets, length n + 1 */
  childStart: Int32Array;
  /** CSR child indices, length n - 1 (one per non-root node) */
  childIdx: Int32Array;
  ply: Int32Array;
  /** 0 = White moved into this node, 1 = Black, -1 = root / none */
  side: Int8Array;
  /** index -> number of children */
  childCount: Int32Array;
  /** index -> deepest ply anywhere in this node's subtree (>= ply[i]) */
  subtreeMaxPly: Int32Array;
  /** node indices sorted by ply descending - a valid leaves-first order
   * for one-pass bottom-up subtree accumulations (spread, etc.) */
  postorder: Int32Array;
  /** index -> display label (SAN, or "Start" for the root) */
  labels: string[];
  rootIdx: number;
};

export function buildFlatTree(tree: MoveTreeState): FlatTree {
  const ids = Object.keys(tree.nodes);
  const n = ids.length;

  const idToIdx = new Map<string, number>();
  for (let i = 0; i < n; i++) idToIdx.set(ids[i], i);

  const parent = new Int32Array(n).fill(-1);
  const ply = new Int32Array(n);
  const side = new Int8Array(n);
  const labels: string[] = new Array(n);
  const childCount = new Int32Array(n);
  let rootIdx = 0;

  for (let i = 0; i < n; i++) {
    const node = tree.nodes[ids[i]];
    ply[i] = node.ply;
    side[i] = node.side === "w" ? 0 : node.side === "b" ? 1 : -1;
    labels[i] = nodeLabel(node);
    if (node.parentId === null) {
      rootIdx = i;
      continue;
    }
    const p = idToIdx.get(node.parentId);
    if (p === undefined) continue; // orphan guard - leave parent[i] = -1
    parent[i] = p;
    childCount[p]++;
  }

  // CSR fill: prefix-sum the child counts, then scatter each node into its
  // parent's slice using a moving cursor.
  const childStart = new Int32Array(n + 1);
  for (let i = 0; i < n; i++) childStart[i + 1] = childStart[i] + childCount[i];
  const childIdx = new Int32Array(childStart[n]);
  const cursor = Int32Array.from(childStart.subarray(0, n));
  for (let i = 0; i < n; i++) {
    const p = parent[i];
    if (p >= 0) childIdx[cursor[p]++] = i;
  }

  // Leaves-first order (ply descending), then subtreeMaxPly bottom-up.
  const postorder = Int32Array.from({ length: n }, (_, i) => i).sort(
    (a, b) => ply[b] - ply[a],
  );
  const subtreeMaxPly = Int32Array.from(ply);
  for (let o = 0; o < n; o++) {
    const i = postorder[o];
    const p = parent[i];
    if (p >= 0 && subtreeMaxPly[i] > subtreeMaxPly[p]) {
      subtreeMaxPly[p] = subtreeMaxPly[i];
    }
  }

  return {
    n,
    ids,
    idToIdx,
    parent,
    childStart,
    childIdx,
    ply,
    side,
    childCount,
    subtreeMaxPly,
    postorder,
    labels,
    rootIdx,
  };
}
