"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import { mergeGamesIntoTree } from "../../lib/pgn-import";
import type { MoveTreeState } from "../../types";

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
  const [result, setResult] = useState<{ imported: number; failed: number } | null>(null);

  function handleClose() {
    setPgnText("");
    setResult(null);
    onClose();
  }

  function handleImport() {
    const merged = mergeGamesIntoTree(tree, pgnText);
    onMerge(merged.tree);
    setResult({ imported: merged.gamesImported, failed: merged.gamesFailed });
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
          <textarea
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
              : "."}
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
