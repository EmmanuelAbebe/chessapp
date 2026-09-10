// Lightweight, dependency-free decorative visuals for the landing page —
// SVG and CSS only, theme-aware via design tokens, all aria-hidden since
// they illustrate rather than inform.

/** A small 8×8 board with a handful of pieces, echoing a middlegame
 * position. Purely decorative. */
export function BoardGlyph({ className = "" }: { className?: string }) {
  // rank 8 -> rank 1, file a -> h. Empty string = empty square.
  const rows = [
    ["r", "", "", "q", "", "r", "k", ""],
    ["p", "p", "", "", "", "p", "b", "p"],
    ["", "", "n", "p", "", "n", "p", ""],
    ["", "", "", "", "p", "", "", ""],
    ["", "", "", "P", "", "", "", ""],
    ["", "", "N", "", "", "N", "", ""],
    ["P", "P", "", "", "", "P", "P", "P"],
    ["R", "", "B", "Q", "R", "", "K", ""],
  ];
  const GLYPH: Record<string, string> = {
    K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘", P: "♙",
    k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟",
  };
  return (
    <div
      aria-hidden="true"
      className={`grid aspect-square w-full grid-cols-8 overflow-hidden rounded-lg border border-border-soft ${className}`}
    >
      {rows.flatMap((row, r) =>
        row.map((piece, f) => {
          const dark = (r + f) % 2 === 1;
          const white = piece === piece.toUpperCase();
          return (
            <div
              key={`${r}-${f}`}
              className={`flex items-center justify-center ${
                dark ? "bg-surface-raised" : "bg-surface"
              }`}
              style={{ fontSize: "min(3.2vw, 1.5rem)", lineHeight: 1 }}
            >
              <span className={white ? "text-text" : "text-text-faint"}>
                {piece ? GLYPH[piece] : ""}
              </span>
            </div>
          );
        }),
      )}
    </div>
  );
}

/** A thin vertical evaluation bar, filled to roughly a small White edge. */
export function EvalBarGlyph({ whitePercent = 58 }: { whitePercent?: number }) {
  return (
    <div
      aria-hidden="true"
      className="relative h-full w-2.5 shrink-0 overflow-hidden rounded-full bg-text"
    >
      <div
        className="absolute inset-x-0 bottom-0 bg-[#1a1a1a]"
        style={{ height: `${100 - whitePercent}%` }}
      />
      <div className="absolute inset-x-0 top-1/2 h-px bg-accent/60" />
    </div>
  );
}

/** The coach's comment card — same visual language as the in-app
 * AiChatPanel (serif voice, sentiment left-edge, eval chip). */
export function CoachCardGlyph({
  quote,
  evalLabel,
  tone = "bad",
}: {
  quote: string;
  evalLabel: string;
  tone?: "good" | "bad" | "neutral";
}) {
  const edge =
    tone === "good"
      ? "border-l-good"
      : tone === "bad"
        ? "border-l-bad"
        : "border-l-accent";
  const chip =
    tone === "good"
      ? "bg-good-soft text-good"
      : tone === "bad"
        ? "bg-bad-soft text-bad"
        : "bg-accent-soft text-accent";
  return (
    <div
      className={`flex flex-col gap-2 rounded-lg border border-l-[3px] border-border-soft bg-surface px-4 py-3 shadow-lg ${edge}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-sm font-medium text-text">
          <span
            aria-hidden="true"
            className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${chip}`}
          >
            {"♞"}
          </span>
          AI Coach
        </span>
        <span
          className={`rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold ${chip}`}
        >
          {evalLabel}
        </span>
      </div>
      <p className="font-serif text-[13.5px] leading-snug text-text">{quote}</p>
    </div>
  );
}

/** A small node graph, standing in for the move-tree map. */
export function MapGlyph({ className = "" }: { className?: string }) {
  const nodes = [
    { x: 20, y: 60, r: 6 },
    { x: 60, y: 40, r: 5 },
    { x: 60, y: 84, r: 4 },
    { x: 104, y: 24, r: 4 },
    { x: 108, y: 56, r: 5 },
    { x: 104, y: 96, r: 3 },
    { x: 150, y: 44, r: 4 },
    { x: 152, y: 70, r: 3 },
  ];
  const edges = [
    [0, 1], [0, 2], [1, 3], [1, 4], [2, 5], [4, 6], [4, 7],
  ];
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 180 120"
      className={`w-full ${className}`}
    >
      {edges.map(([a, b], i) => (
        <line
          key={i}
          x1={nodes[a].x}
          y1={nodes[a].y}
          x2={nodes[b].x}
          y2={nodes[b].y}
          stroke="var(--border)"
          strokeWidth={1.5}
        />
      ))}
      {nodes.map((n, i) => (
        <circle
          key={i}
          cx={n.x}
          cy={n.y}
          r={n.r}
          fill={i === 0 ? "var(--accent)" : "var(--surface-raised)"}
          stroke={i === 0 ? "var(--accent)" : "var(--border)"}
          strokeWidth={1.5}
        />
      ))}
    </svg>
  );
}

/** A few labelled bars, standing in for the statistics profile. */
export function TraitBarsGlyph() {
  const traits = [
    { label: "Aggression", value: 72 },
    { label: "Vigilance", value: 44 },
    { label: "Repertoire", value: 61 },
    { label: "Time pressure", value: 33 },
  ];
  return (
    <div aria-hidden="true" className="flex flex-col gap-2.5">
      {traits.map((t) => (
        <div key={t.label} className="flex items-center gap-3">
          <span className="w-24 shrink-0 text-right text-[11px] text-text-dim">
            {t.label}
          </span>
          <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-raised">
            <span
              className="block h-full rounded-full bg-accent/70"
              style={{ width: `${t.value}%` }}
            />
          </span>
        </div>
      ))}
    </div>
  );
}
