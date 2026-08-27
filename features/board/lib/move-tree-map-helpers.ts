import type { MoveNode, MoveTreeState } from "../types";

// Forks aren't part of the app's neutral theme token set (like `bad`/`good`,
// this is a new semantic this feature introduces) - fixed regardless of
// theme shade, matching the color validated in the standalone prototype.
export const HUB_COLOR = "#e0a458";

export type ThemeColors = {
  background: string;
  surface: string;
  border: string;
  borderSoft: string;
  text: string;
  textDim: string;
  textFaint: string;
  accent: string;
  accentSoft: string;
};

// Canvas fill/stroke colors have to be resolved strings, not CSS vars - read
// straight from the current theme (charcoal/midnight/slate, whichever the
// user has selected) rather than hardcoding one palette, so the map matches
// the rest of the app's theming instead of only ever looking right in one
// theme.
export function readThemeColors(): ThemeColors {
  const style = getComputedStyle(document.documentElement);
  const get = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
  return {
    background: get("--background", "#0a0a0a"),
    surface: get("--surface", "#171717"),
    border: get("--border", "#3a3a3a"),
    borderSoft: get("--border-soft", "#262626"),
    text: get("--text", "#e8e8e6"),
    textDim: get("--text-dim", "#9a9a97"),
    textFaint: get("--text-faint", "#6b6b68"),
    accent: get("--accent", "#5b9dfa"),
    accentSoft: get("--accent-soft", "rgba(91, 157, 250, 0.14)"),
  };
}

export function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const value = parseInt(full, 16);
  const r = (value >> 16) & 255, g = (value >> 8) & 255, b = value & 255;
  if (Number.isNaN(value)) return hex;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Every color the canvas draws that's worth letting someone tune live
// instead of hunting through the draw loop's source - grouped the same way
// the map itself reads visually: curves (boundary/rings/edges), nodes, and
// the highlight rings drawn around a node/ring for focus, current, hover, or
// a selected ply. Each is a plain hex string so it can back a native
// `<input type="color">` directly; the draw loop applies whatever alpha a
// given element needs on top of it.
export type MapColorKey =
  | "boundary"
  | "ringMajor"
  | "ringMinor"
  | "edge"
  | "edgeMainLine"
  | "edgeHubParent"
  | "nodeWhite"
  | "nodeBlack"
  | "highlightFocus"
  | "highlightCurrent"
  | "highlightHover"
  | "highlightRingSelect";

export type MapColorOverrides = Partial<Record<MapColorKey, string>>;

export const MAP_COLOR_GROUPS: { title: string; keys: MapColorKey[] }[] = [
  { title: "Curves", keys: ["boundary", "ringMajor", "ringMinor", "edge", "edgeMainLine", "edgeHubParent"] },
  { title: "Nodes", keys: ["nodeWhite", "nodeBlack"] },
  { title: "Highlights", keys: ["highlightFocus", "highlightCurrent", "highlightHover", "highlightRingSelect"] },
];

export const MAP_COLOR_LABELS: Record<MapColorKey, string> = {
  boundary: "Disk boundary",
  ringMajor: "Major depth ring",
  ringMinor: "Minor depth ring",
  edge: "Edge (default)",
  edgeMainLine: "Edge (main line)",
  edgeHubParent: "Edge (from a fork)",
  nodeWhite: "Node - White move",
  nodeBlack: "Node - Black move",
  highlightFocus: "Focus ring",
  highlightCurrent: "Current-move ring",
  highlightHover: "Hover ring",
  highlightRingSelect: "Selected-ply ring",
};

// Seed values for the picker before anything's overridden - close
// approximations of the live theme-derived defaults, not a live read of
// them, since these need to exist before the canvas (and its DOM access)
// has necessarily mounted.
export const MAP_COLOR_DEFAULTS: Record<MapColorKey, string> = {
  boundary: "#5b9dfa",
  ringMajor: "#5b9dfa",
  ringMinor: "#262626",
  edge: "#3a3a3a",
  edgeMainLine: "#5b9dfa",
  edgeHubParent: HUB_COLOR,
  nodeWhite: "#e8e8e6",
  nodeBlack: "#e8e8e6",
  highlightFocus: "#5b9dfa",
  highlightCurrent: "#5b9dfa",
  highlightHover: "#e8e8e6",
  highlightRingSelect: "#5b9dfa",
};

export function isHub(node: MoveNode): boolean {
  return node.children.length >= 3;
}

export function nodeLabel(node: MoveNode): string {
  return node.parentId === null ? "Start" : (node.san ?? "?");
}

export function getBreadcrumb(tree: MoveTreeState, focusId: string): MoveNode[] {
  const chain: MoveNode[] = [];
  let cursor: string | null = focusId;
  while (cursor) {
    const node: MoveNode = tree.nodes[cursor];
    chain.unshift(node);
    cursor = node.parentId;
  }
  return chain;
}

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export const RING_HIGHLIGHT_STEP = 0.18; // per-frame ease rate, ~5-6 frames to settle at 60fps

// Eases every tracked ply's intensity toward 1 if it's the current target,
// toward 0 otherwise, and drops entries once they've fully faded out so the
// map doesn't grow forever as the cursor wanders across rings.
export function stepIntensityMap(map: Map<number, number>, targetPly: number | null) {
  if (targetPly !== null && !map.has(targetPly)) map.set(targetPly, 0);
  for (const [ply, value] of map) {
    const target = ply === targetPly ? 1 : 0;
    const next = value + (target - value) * RING_HIGHLIGHT_STEP;
    if (target === 0 && next < 0.01) map.delete(ply);
    else map.set(ply, next);
  }
}
