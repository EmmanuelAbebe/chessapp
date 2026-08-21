"use client";

import { useState, type ComponentType } from "react";
import { defaultPieces } from "react-chessboard";
import Modal from "@/components/ui/Modal";
import SettingsSelect from "@/features/settings/components/SettingsSelect";
import type { SideChoice } from "../hooks/useGameMode";
import { formatGameStatus, type GameStatus } from "../lib/game-status";

const WINNER_KING = {
  white: defaultPieces.wK,
  black: defaultPieces.bK,
};

const WhiteKing = defaultPieces.wK;
const BlackKing = defaultPieces.bK;

/** Half of each king's own SVG, clipped side by side - white on the left,
 * black on the right - to represent "random" without a third made-up icon. */
function SplitKingIcon() {
  return (
    <div className="relative h-full w-full">
      <div className="absolute inset-0" style={{ clipPath: "inset(0 50% 0 0)" }}>
        <WhiteKing />
      </div>
      <div className="absolute inset-0" style={{ clipPath: "inset(0 0 0 50%)" }}>
        <BlackKing />
      </div>
    </div>
  );
}

const SIDE_ICONS: Record<SideChoice, ComponentType> = {
  white: WhiteKing,
  black: BlackKing,
  random: SplitKingIcon,
};

const DIFFICULTY_PRESETS = [
  { label: "Beginner", skill: 2 },
  { label: "Easy", skill: 6 },
  { label: "Medium", skill: 10 },
  { label: "Hard", skill: 15 },
  { label: "Expert", skill: 20 },
];

const SIDE_OPTIONS: SideChoice[] = ["white", "black", "random"];

const COMING_SOON = [
  {
    title: "Play against AI Coach",
    description: "A coaching AI that adapts to how you play.",
  },
  {
    title: "Lesson",
    description: "Guided lessons on openings, tactics, and endgames.",
  },
  {
    title: "Puzzle",
    description: "Solve tactical puzzles to sharpen your calculation.",
  },
];

type GameModeModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onStartNewGame: () => void;
  onStartVsStockfish: (side: SideChoice, skillLevel: number) => void;
  gameStatus?: GameStatus;
};

export function GameModeModal({
  isOpen,
  onClose,
  onStartNewGame,
  onStartVsStockfish,
  gameStatus,
}: GameModeModalProps) {
  const statusMessage = gameStatus ? formatGameStatus(gameStatus) : null;
  const WinnerKing = gameStatus?.winner ? WINNER_KING[gameStatus.winner] : null;
  const [showStockfishSetup, setShowStockfishSetup] = useState(false);
  const [difficulty, setDifficulty] = useState("Medium");
  const [side, setSide] = useState<SideChoice>("white");

  function handleClose() {
    setShowStockfishSetup(false);
    onClose();
  }

  function handleStartNewGame() {
    onStartNewGame();
    handleClose();
  }

  function handleStartVsStockfish() {
    const preset = DIFFICULTY_PRESETS.find((p) => p.label === difficulty);
    onStartVsStockfish(side, preset?.skill ?? 10);
    handleClose();
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose}>
      <div className="w-full max-w-md">
        <h2 className="text-xl font-bold text-text">Game Mode</h2>

        {statusMessage && (
          <div className="my-9 rounded-lg border border-accent/30 bg-accent/10 px-4 py-3 text-center">
            {WinnerKing && (
              <div className="mx-auto mb-2 h-16 w-16">
                <WinnerKing />
              </div>
            )}
            <p className="text-4xl font-bold text-text uppercase text-spacing-wider">
              {statusMessage}
            </p>
          </div>
        )}

        {!showStockfishSetup ? (
          <div className="mt-6 flex flex-col gap-3">
            <button
              type="button"
              onClick={handleStartNewGame}
              className="flex flex-col gap-1 rounded-lg border border-border p-3 text-left transition hover:border-accent hover:bg-white/5"
            >
              <span className="font-semibold text-text">Start New Game</span>
              <span className="text-xs text-text-faint">
                Reset the board and analyze freely.
              </span>
            </button>

            <button
              type="button"
              onClick={() => setShowStockfishSetup(true)}
              className="flex flex-col gap-1 rounded-lg border border-border p-3 text-left transition hover:border-accent hover:bg-white/5"
            >
              <span className="font-semibold text-text">
                Play against Stockfish
              </span>
              <span className="text-xs text-text-faint">
                Choose a side and difficulty - the engine plays the other side.
              </span>
            </button>

            {COMING_SOON.map((item) => (
              <div
                key={item.title}
                aria-disabled="true"
                className="flex flex-col gap-1 rounded-lg border border-border-soft p-3 text-left opacity-50"
              >
                <span className="flex items-center gap-2 font-semibold text-text">
                  {item.title}
                  <span className="rounded-full bg-surface-raised px-2 py-0.5 text-[10px] font-medium text-text-dim">
                    Coming soon
                  </span>
                </span>
                <span className="text-xs text-text-faint">
                  {item.description}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-6 flex flex-col gap-4">
            <button
              type="button"
              onClick={() => setShowStockfishSetup(false)}
              className="self-start text-xs font-medium text-text-dim hover:text-text"
            >
              ← Back
            </button>

            <div>
              <span className="mb-2 block text-sm font-medium text-text">
                Play as
              </span>
              <div className="flex gap-2">
                {SIDE_OPTIONS.map((option) => {
                  const Icon = SIDE_ICONS[option];
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setSide(option)}
                      aria-label={option}
                      aria-pressed={side === option}
                      title={option}
                      className={`flex flex-1 items-center justify-center rounded-none border p-2 transition ${
                        side === option
                          ? "border-accent bg-accent/10"
                          : "border-border hover:border-accent"
                      }`}
                    >
                      <div className="h-16 w-16">
                        <Icon />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <SettingsSelect
              setting={{
                label: "Difficulty",
                value: difficulty,
                options: DIFFICULTY_PRESETS.map((p) => p.label),
                onChange: setDifficulty,
              }}
            />

            <button
              type="button"
              onClick={handleStartVsStockfish}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-text transition hover:brightness-110"
            >
              Start Game
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
