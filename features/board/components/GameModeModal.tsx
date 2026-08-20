"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import SettingsSelect from "@/features/settings/components/SettingsSelect";
import type { SideChoice } from "../hooks/useGameMode";

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
};

export function GameModeModal({
  isOpen,
  onClose,
  onStartNewGame,
  onStartVsStockfish,
}: GameModeModalProps) {
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
        <h2 className="text-xl font-bold text-white">Game Mode</h2>

        {!showStockfishSetup ? (
          <div className="mt-6 flex flex-col gap-3">
            <button
              type="button"
              onClick={handleStartNewGame}
              className="flex flex-col gap-1 rounded-lg border border-neutral-700 p-3 text-left transition hover:border-neutral-600 hover:bg-white/5"
            >
              <span className="font-semibold text-white">Start New Game</span>
              <span className="text-xs text-neutral-500">
                Reset the board and analyze freely.
              </span>
            </button>

            <button
              type="button"
              onClick={() => setShowStockfishSetup(true)}
              className="flex flex-col gap-1 rounded-lg border border-neutral-700 p-3 text-left transition hover:border-neutral-600 hover:bg-white/5"
            >
              <span className="font-semibold text-white">
                Play against Stockfish
              </span>
              <span className="text-xs text-neutral-500">
                Choose a side and difficulty - the engine plays the other
                side.
              </span>
            </button>

            {COMING_SOON.map((item) => (
              <div
                key={item.title}
                aria-disabled="true"
                className="flex flex-col gap-1 rounded-lg border border-neutral-800 p-3 text-left opacity-50"
              >
                <span className="flex items-center gap-2 font-semibold text-white">
                  {item.title}
                  <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-[10px] font-medium text-neutral-400">
                    Coming soon
                  </span>
                </span>
                <span className="text-xs text-neutral-500">
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
              className="self-start text-xs font-medium text-neutral-400 hover:text-neutral-200"
            >
              ← Back
            </button>

            <div>
              <span className="mb-2 block text-sm font-medium text-neutral-300">
                Play as
              </span>
              <div className="flex gap-2">
                {SIDE_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setSide(option)}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium capitalize transition ${
                      side === option
                        ? "border-blue-500 bg-blue-500/10 text-blue-400"
                        : "border-neutral-700 text-neutral-300 hover:border-neutral-600"
                    }`}
                  >
                    {option}
                  </button>
                ))}
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
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500"
            >
              Start Game
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
