"use client";

import type {} from "react/canary";
import { startTransition, useEffect, useState, ViewTransition, type ComponentType } from "react";
import { defaultPieces } from "react-chessboard";
import { Chess } from "chess.js";
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

export type GameModeStep =
  | "list"
  | "stockfish"
  | "position"
  | "ai-coach"
  | "puzzles";

type GameModeModalProps = {
  isOpen: boolean;
  onClose: () => void;
  initialStep: GameModeStep;
  onStartVsStockfish: (side: SideChoice, skillLevel: number) => void;
  onSetupPosition: (fen: string) => void;
  onOpenBoardEditor: () => void;
  gameStatus?: GameStatus;
};

export function GameModeModal({
  isOpen,
  onClose,
  initialStep,
  onStartVsStockfish,
  onSetupPosition,
  onOpenBoardEditor,
  gameStatus,
}: GameModeModalProps) {
  const statusMessage = gameStatus ? formatGameStatus(gameStatus) : null;
  const WinnerKing = gameStatus?.winner ? WINNER_KING[gameStatus.winner] : null;
  const [step, setStep] = useState<GameModeStep>(initialStep);
  const [difficulty, setDifficulty] = useState("Medium");
  const [side, setSide] = useState<SideChoice>("white");
  const [customFen, setCustomFen] = useState("");
  const [fenError, setFenError] = useState<string | null>(null);

  // The modal is controlled from outside (which icon on the board's side
  // menu opened it) rather than always starting on the list - reset to
  // whatever step it was asked to open on each time it opens.
  useEffect(() => {
    if (isOpen) setStep(initialStep);
  }, [isOpen, initialStep]);

  function handleClose() {
    setFenError(null);
    onClose();
  }

  function openStep(next: GameModeStep) {
    startTransition(() => setStep(next));
  }

  function handleStartVsStockfish() {
    const preset = DIFFICULTY_PRESETS.find((p) => p.label === difficulty);
    onStartVsStockfish(side, preset?.skill ?? 10);
    handleClose();
  }

  function handleSetupPosition() {
    const fen = customFen.trim();
    try {
      // Throws for anything structurally invalid - chess.js's own
      // validation, same as every other FEN parse in this app.
      new Chess(fen);
    } catch {
      setFenError("That doesn't look like a valid FEN.");
      return;
    }
    setFenError(null);
    onSetupPosition(fen);
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
                  Choose a side and difficulty - the engine plays the other side.
                </span>
              </button>

              <button
                type="button"
                onClick={() => openStep("position")}
                className="flex flex-col gap-1 rounded-lg border border-border p-3 text-left transition hover:border-accent hover:bg-white/5"
              >
                <span className="font-semibold text-text">Set up position</span>
                <span className="text-xs text-text-faint">
                  Start from any FEN - an endgame tactic, a book position,
                  anything not reachable by playing from move 1.
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
          ) : step === "ai-coach" ? (
            <ComingSoonStep
              title={AI_COACH_INFO.title}
              description={AI_COACH_INFO.description}
              onBack={() => openStep("list")}
            />
          ) : step === "puzzles" ? (
            <ComingSoonStep
              title={PUZZLES_INFO.title}
              description={PUZZLES_INFO.description}
              onBack={() => openStep("list")}
            />
          ) : (
            <div className="mt-6 flex flex-col gap-4">
              <button
                type="button"
                onClick={() => openStep("list")}
                className="self-start text-xs font-medium text-text-dim hover:text-text"
              >
                ← Back
              </button>

              <button
                type="button"
                onClick={() => {
                  onOpenBoardEditor();
                  handleClose();
                }}
                className="flex flex-col gap-1 rounded-lg border border-border p-3 text-left transition hover:border-accent hover:bg-white/5"
              >
                <span className="font-semibold text-text">
                  Drag pieces on the board
                </span>
                <span className="text-xs text-text-faint">
                  Build the position visually instead of typing a FEN.
                </span>
              </button>

              <div className="flex items-center gap-2 text-xs text-text-faint">
                <div className="h-px flex-1 bg-border" />
                or paste a FEN
                <div className="h-px flex-1 bg-border" />
              </div>

              <div>
                <label
                  htmlFor="custom-fen"
                  className="mb-2 block text-sm font-medium text-text"
                >
                  FEN
                </label>
                <input
                  id="custom-fen"
                  type="text"
                  value={customFen}
                  onChange={(e) => {
                    setCustomFen(e.target.value);
                    setFenError(null);
                  }}
                  placeholder="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
                  className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 font-mono text-xs text-text placeholder:text-text-faint focus:border-accent focus:outline-none"
                />
                {fenError && (
                  <p className="mt-1.5 text-xs text-red-400">{fenError}</p>
                )}
              </div>

              <button
                type="button"
                onClick={handleSetupPosition}
                disabled={!customFen.trim()}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-text transition hover:brightness-110 disabled:pointer-events-none disabled:opacity-50"
              >
                Start from this position
              </button>
            </div>
          )}
        </ViewTransition>
      </div>
    </Modal>
  );
}
