import type { ThemeShade } from "./types";

export const pieceSets = [
  "Default",
  "Alpha",
  "Merida",
  "Fantasy",
  "Classic",
  "Neo",
  "Modern",
];

export const boardThemes = ["Default", "Wood", "Marble"];

export const moveMethods = ["Default", "Click", "Drag"];

export const themeShades: { value: ThemeShade; label: string }[] = [
  { value: "midnight", label: "Midnight" },
  { value: "charcoal", label: "Charcoal" },
  { value: "slate", label: "Slate" },
  { value: "paper", label: "Paper" },
];
