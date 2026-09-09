import type { ParsedMove } from "@/features/board/lib/pgn-import";

// A small opening-name book, used only when a game's PGN didn't carry an
// `Opening` header (lichess exports do; chess.com and live games often
// don't). Keyed by the opening SAN sequence, matched as a prefix -
// longest match wins - and collapsed to the broad family name (no
// variation detail), which is the granularity the Statistics breakdown
// wants. Not exhaustive; anything unmatched shows as "Other".

const BOOK: [string, string][] = [
  // --- 1.e4 ---
  ["e4 e5 Nf3 Nc6 Bb5", "Ruy Lopez"],
  ["e4 e5 Nf3 Nc6 Bc4", "Italian Game"],
  ["e4 e5 Nf3 Nc6 d4", "Scotch Game"],
  ["e4 e5 Nf3 Nc6 Nc3", "Four Knights Game"],
  ["e4 e5 Nf3 Nf6", "Petrov Defense"],
  ["e4 e5 Nf3 d6", "Philidor Defense"],
  ["e4 e5 Nc3", "Vienna Game"],
  ["e4 e5 f4", "King's Gambit"],
  ["e4 e5 Bc4", "Bishop's Opening"],
  ["e4 e5 d4", "Center Game"],
  ["e4 e5", "Open Game"],
  ["e4 c5", "Sicilian Defense"],
  ["e4 e6", "French Defense"],
  ["e4 c6", "Caro-Kann Defense"],
  ["e4 d5", "Scandinavian Defense"],
  ["e4 d6", "Pirc Defense"],
  ["e4 g6", "Modern Defense"],
  ["e4 Nf6", "Alekhine Defense"],
  ["e4 b6", "Owen Defense"],
  ["e4 Nc6", "Nimzowitsch Defense"],
  ["e4", "King's Pawn Opening"],
  // --- 1.d4 ---
  ["d4 d5 c4 c6", "Slav Defense"],
  ["d4 d5 c4 dxc4", "Queen's Gambit Accepted"],
  ["d4 d5 c4 e6", "Queen's Gambit Declined"],
  ["d4 d5 c4 Nc6", "Chigorin Defense"],
  ["d4 d5 c4", "Queen's Gambit"],
  ["d4 d5 Nf3 Nf6 Bf4", "London System"],
  ["d4 d5 Bf4", "London System"],
  ["d4 d5 Nc3", "Richter-Veresov Attack"],
  ["d4 d5", "Queen's Pawn Game"],
  ["d4 Nf6 c4 e6 Nc3 Bb4", "Nimzo-Indian Defense"],
  ["d4 Nf6 c4 e6 Nf3 b6", "Queen's Indian Defense"],
  ["d4 Nf6 c4 e6 Nf3 Bb4", "Bogo-Indian Defense"],
  ["d4 Nf6 c4 e6", "Indian Game"],
  ["d4 Nf6 c4 g6 Nc3 d5", "Grünfeld Defense"],
  ["d4 Nf6 c4 g6", "King's Indian Defense"],
  ["d4 Nf6 c4 c5", "Benoni Defense"],
  ["d4 Nf6 c4 e5", "Budapest Gambit"],
  ["d4 Nf6 Bg5", "Trompowsky Attack"],
  ["d4 Nf6 Nf3 g6 Bf4", "London System"],
  ["d4 Nf6 c4", "Indian Game"],
  ["d4 Nf6", "Indian Defense"],
  ["d4 f5", "Dutch Defense"],
  ["d4 e6", "Queen's Pawn Game"],
  ["d4 d6", "Rat Defense"],
  ["d4 g6", "Modern Defense"],
  ["d4", "Queen's Pawn Opening"],
  // --- flank / other ---
  ["c4 e5", "English Opening (Reversed Sicilian)"],
  ["c4 Nf6", "English Opening"],
  ["c4 c5", "English Opening (Symmetrical)"],
  ["c4 e6", "English Opening"],
  ["c4", "English Opening"],
  ["Nf3 d5 c4", "Réti Opening"],
  ["Nf3 d5 g3", "King's Indian Attack"],
  ["Nf3 Nf6 g3", "King's Indian Attack"],
  ["Nf3 d5", "Réti Opening"],
  ["Nf3 Nf6 c4", "English Opening"],
  ["Nf3", "Réti Opening"],
  ["g3", "King's Fianchetto Opening"],
  ["b3", "Nimzo-Larsen Attack"],
  ["b4", "Polish Opening"],
  ["f4", "Bird's Opening"],
  ["Nc3", "Dunst Opening"],
  ["g4", "Grob Opening"],
  ["d3", "Mieses Opening"],
  ["e3", "Van 't Kruijs Opening"],
];

// Longest sequence first, so a prefix match is always the most specific.
const BOOK_SORTED = [...BOOK].sort((a, b) => b[0].length - a[0].length);

/** Broad family name for an opening from its moves, or null. */
export function lookupOpeningName(moves: ParsedMove[]): string | null {
  const seq = moves
    .slice(0, 12)
    .map((m) => m.san.replace(/[+#]/g, ""))
    .join(" ");
  if (!seq) return null;
  for (const [book, name] of BOOK_SORTED) {
    if (seq === book || seq.startsWith(book + " ")) return name;
  }
  return null;
}
