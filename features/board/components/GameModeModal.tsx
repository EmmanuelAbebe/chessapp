"use client";

import type {} from "react/canary";
import { startTransition, useEffect, useState, ViewTransition } from "react";
import { defaultPieces } from "react-chessboard";
import Modal from "@/components/ui/Modal";
import SettingsSelect from "@/features/settings/components/SettingsSelect";
import { formatGameStatus, type GameStatus } from "../lib/game-status";

const WINNER_KING = {
  white: defaultPieces.wK,
  black: defaultPieces.bK,
};

const DIFFICULTY_PRESETS = [
  { label: "Beginner", skill: 2 },
  { label: "Easy", skill: 6 },
  { label: "Medium", skill: 10 },
  { label: "Hard", skill: 15 },
  { label: "Expert", skill: 20 },
];

const COMING_SOON = [
  {
    title: "Lesson",
    description: "Guided lessons on openings, tactics, and endgames.",
  },
];

const AI_COACH_INFO = {
  title: "Play against AI Coach",
  description: "A coaching AI that adapts to how you play.",
};

const PUZZLES_INFO = {
  title: "Puzzles",
  description:
    "Solve tactical puzzles to sharpen your calculation. Difficulty selection is coming soon.",
};

/** Full-step placeholder for a mode that has its own side-menu icon but
 * isn't built yet - same title/description/pill treatment as a disabled
 * list card, just reachable directly instead of buried in the list. */
function ComingSoonStep({
  title,
  description,
  onBack,
}: {
  title: string;
  description: string;
  onBack: () => void;
}) {
  return (
    <div className="mt-6 flex flex-col gap-4">
      <button
        type="button"
        onClick={onBack}
        className="self-start text-xs font-medium text-text-dim hover:text-text"
      >
        ← Back
      </button>

      <div className="flex flex-col gap-1 rounded-lg border border-border-soft p-3 text-left opacity-50">
        <span className="flex items-center gap-2 font-semibold text-text">
          {title}
          <span className="rounded-full bg-surface-raised px-2 py-0.5 text-[10px] font-medium text-text-dim">
            Coming soon
          </span>
        </span>
        <span className="text-xs text-text-faint">{description}</span>
      </div>
    </div>
  );
}

export type GameModeStep = "list" | "stockfish" | "ai-coach" | "puzzles";

type GameModeModalProps = {
  isOpen: boolean;
  onClose: () => void;
  initialStep: GameModeStep;
  onStartVsStockfish: (skillLevel: number) => void;
  onOpenBoardEditor: () => void;
  gameStatus?: GameStatus;
};

export function GameModeModal({
  isOpen,
  onClose,
  initialStep,
  onStartVsStockfish,
  onOpenBoardEditor,
  gameStatus,
}: GameModeModalProps) {
  const statusMessage = gameStatus ? formatGameStatus(gameStatus) : null;
  const WinnerKing = gameStatus?.winner ? WINNER_KING[gameStatus.winner] : null;
  const [step, setStep] = useState<GameModeStep>(initialStep);
  const [difficulty, setDifficulty] = useState("Medium");

  // The modal is controlled from outside (which icon on the board's side
  // menu opened it) rather than always starting on the list - reset to
  // whatever step it was asked to open on each time it opens.
  useEffect(() => {
    if (isOpen) setStep(initialStep);
  }, [isOpen, initialStep]);

  function handleClose() {
    onClose();
  }

  function openStep(next: GameModeStep) {
    startTransition(() => setStep(next));
  }

  function handleStartVsStockfish() {
    const preset = DIFFICULTY_PRESETS.find((p) => p.label === difficulty);
    onStartVsStockfish(preset?.skill ?? 10);
    handleClose();
  }

  function handleOpenBoardEditor() {
    onOpenBoardEditor();
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

        <ViewTransition
          key={step}
          name="game-mode-step"
          share="auto"
          enter="auto"
          default="none"
        >
          {step === "list" ? (
            <div className="mt-6 flex flex-col gap-3">
              <button
                type="button"
                onClick={() => openStep("stockfish")}
                className="flex flex-col gap-1 rounded-lg border border-border p-3 text-left transition hover:border-accent hover:bg-white/5"
              >
                <span className="font-semibold text-text">
                  Play against Stockfish
                </span>
                <span className="text-xs text-text-faint">
                  Pick a difficulty, then make the first move as either
                  color - Stockfish plays whichever side you don't.
                </span>
              </button>

              <button
                type="button"
                onClick={handleOpenBoardEditor}
                className="flex flex-col gap-1 rounded-lg border border-border p-3 text-left transition hover:border-accent hover:bg-white/5"
              >
                <span className="font-semibold text-text">Set up position</span>
                <span className="text-xs text-text-faint">
                  Drag pieces or paste a FEN/PGN - an endgame tactic, a book
                  position, anything not reachable by playing from move 1.
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
          ) : step === "stockfish" ? (
            <div className="mt-6 flex flex-col gap-4">
              <button
                type="button"
                onClick={() => openStep("list")}
                className="self-start text-xs font-medium text-text-dim hover:text-text"
              >
                ← Back
              </button>

              <p className="text-xs text-text-faint">
                Make your first move as either color once the game starts -
                Stockfish takes whichever side you didn't.
              </p>

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
          ) : step === "ai-coach" ? (
            <ComingSoonStep
              title={AI_COACH_INFO.title}
              description={AI_COACH_INFO.description}
              onBack={() => openStep("list")}
            />
          ) : (
            <ComingSoonStep
              title={PUZZLES_INFO.title}
              description={PUZZLES_INFO.description}
              onBack={() => openStep("list")}
            />
          )}
        </ViewTransition>
      </div>
    </Modal>
  );
}
