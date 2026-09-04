"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import { matchPlayerSide, mergeGamesIntoTree } from "../../lib/pgn-import";
import type { MoveTreeState } from "../../types";
import { usePlayerIdentity } from "@/features/settings/usePlayerIdentity";
import { useGameHistory } from "@/features/history/useGameHistory";
import { createHistoryId, resultForSide, type GameHistoryEntry } from "@/features/history/types";

type MapImportGamesModalProps = {
  isOpen: boolean;
  onClose: () => void;
  tree: MoveTreeState;
  onMerge: (tree: MoveTreeState) => void;
};

export function MapImportGamesModal({
  isOpen,
  onClose,
  tree,
  onMerge,
}: MapImportGamesModalProps) {
  const [pgnText, setPgnText] = useState("");
  const [result, setResult] = useState<{ imported: number; failed: number; matched: number } | null>(null);
  // The same persisted store Settings' Player Identity section reads/
  // writes - editing it here updates it there too, so there's only ever
  // one place this actually lives.
  const { usernames, setUsernames, usernameList } = usePlayerIdentity();
  const { addGames } = useGameHistory();

  function handleClose() {
    setPgnText("");
    setResult(null);
    onClose();
  }

  function handleImport() {
    const merged = mergeGamesIntoTree(tree, pgnText);
    onMerge(merged.tree);

    // Attribute whichever games match a saved username - asking per-game
    // which side you played isn't practical for a batch of many pasted
    // games, so anything that doesn't match is still merged into the map
    // tree above, just silently left out of the Statistics history.
    const matched: GameHistoryEntry[] = [];
    for (const game of merged.parsedGames) {
      const side = matchPlayerSide(game.headers, usernameList);
      if (!side) continue;
      matched.push({
        id: createHistoryId(),
        source: "import",
        playedAt: Date.now(),
        playerSide: side,
        result: resultForSide(game.headers.Result ?? "*", side),
        opponentName: side === "w" ? game.headers.Black : game.headers.White,
        timeControl: game.headers.TimeControl,
        moves: game.moves,
      });
    }
    addGames(matched);

    setResult({ imported: merged.gamesImported, failed: merged.gamesFailed, matched: matched.length });
    // Games are additive (nothing to undo/retype), so the pasted text can
    // go - only the result summary needs to stay on screen.
    setPgnText("");
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose}>
      <div className="w-full max-w-md">
        <h2 className="text-xl font-bold text-text">Import games</h2>
        <p className="mt-1 text-xs text-text-faint">
          Paste one or many PGN games at once - a lichess.org bulk export
          works as-is. Shared openings merge into the same branch; each
          game only forks off where it actually diverges.
        </p>

        <div className="mt-4">
          <label
            htmlFor="map-import-usernames"
            className="mb-1.5 block text-sm font-medium text-text"
          >
            Your usernames
          </label>
          <input
            id="map-import-usernames"
            type="text"
            value={usernames}
            onChange={(e) => setUsernames(e.target.value)}
            placeholder="e.g. jonkimura33, MyChessComHandle"
            autoComplete="off"
            className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 font-mono text-xs text-text placeholder:text-text-faint focus:border-accent focus:outline-none"
          />
          <p className="mt-1 text-xs text-text-faint">
            Comma-separated - matched against each game's White/Black names
            so it counts as yours on the Statistics page. Same as the
            Settings page; stored only in your browser.
          </p>
        </div>

        <div className="mt-4">
          <label
            htmlFor="map-import-pgn"
            className="mb-1.5 block text-sm font-medium text-text"
          >
            PGN
          </label>
          <textarea
            id="map-import-pgn"
            value={pgnText}
            onChange={(e) => {
              setPgnText(e.target.value);
              setResult(null);
            }}
            placeholder={'[Event "..."]\n[White "..."]\n[Black "..."]\n\n1. e4 e5 2. Nf3 ...\n\n[Event "..."]\n...'}
            rows={10}
            className="w-full resize-none rounded-lg border border-border bg-surface-raised px-3 py-2 font-mono text-xs text-text placeholder:text-text-faint focus:border-accent focus:outline-none"
          />
        </div>

        {result && (
          <p className="mt-2 text-xs text-text-dim">
            Merged {result.imported} game{result.imported === 1 ? "" : "s"}
            {result.failed > 0
              ? ` - ${result.failed} couldn't be parsed and ${result.failed === 1 ? "was" : "were"} skipped.`
              : "."}{" "}
            {result.matched} of {result.imported} matched your username and{" "}
            {result.matched === 1 ? "was" : "were"} added to your stats.
          </p>
        )}

        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={handleImport}
            disabled={!pgnText.trim()}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-text transition hover:brightness-110 disabled:pointer-events-none disabled:opacity-50"
          >
            Import
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-text-dim transition hover:border-accent hover:text-text"
          >
            {result ? "Done" : "Cancel"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
