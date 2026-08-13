// import type { ParsedEngineInfo } from "../types";

// export function parseEngineInfoLine(line: string): ParsedEngineInfo | null {
//   if (!line.startsWith("info")) return null;

//   const depthMatch = line.match(/\bdepth\s+(\d+)/);
//   const cpMatch = line.match(/\bscore\s+cp\s+(-?\d+)/);
//   const mateMatch = line.match(/\bscore\s+mate\s+(-?\d+)/);
//   const pvMatch = line.match(/\bpv\s+(\S+)/);

//   const depth = depthMatch ? Number(depthMatch[1]) : 0;
//   const cp = cpMatch ? Number(cpMatch[1]) : null;
//   const mate = mateMatch ? Number(mateMatch[1]) : null;
//   const bestMoveFromPv = pvMatch?.[1] ?? null;

//   if (cp === null && mate === null) return null;

//   return {
//     depth,
//     cp,
//     mate,
//     bestMoveFromPv,
//   };
// }

// export function parseBestMoveLine(line: string) {
//   if (!line.startsWith("bestmove")) return null;

//   const match = line.match(/^bestmove\s+(\S+)/);
//   const bestMove = match?.[1] ?? null;

//   if (!bestMove || bestMove === "(none)") return null;
//   return bestMove;
// }

export function parseBestMove(line: string): string | null {
  if (!line.startsWith("bestmove")) return null;

  const match = line.match(/^bestmove\s+(\S+)/);
  return match?.[1] ?? null;
}
