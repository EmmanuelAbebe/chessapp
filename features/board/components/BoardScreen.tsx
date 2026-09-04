"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { Arrow } from "react-chessboard";
import { EvalBar } from "./EvalBar";
import { EvalScoreLabel } from "./EvalScoreLabel";
import { BoardView } from "./BoardView";
import { BoardControls } from "./BoardControls";
import type { GameModeStep } from "./GameModeModal";
import { MoveList } from "./MoveList";
import { MoveNavigation } from "./MoveNavigation";
import { AiChatPanel, type CommentarySentiment } from "./AiChatPanel";
import { useBoardGameContext } from "../BoardGameContext";
import { useBoardSettings } from "../hooks/useBoardSettings";
import { useEvalScore, type CandidateMove } from "../hooks/useEvalScore";
import { useMoveCommentary, type AnnotationColor } from "../hooks/useMoveCommentary";
import { usePositionCommentary } from "../hooks/usePositionCommentary";
import { Chess } from "chess.js";
import { detectHangingPieces } from "../lib/board-tactics";
import { formatEvalFromWhiteScore, selectCloseCandidates } from "../lib/eval-format";
import { importPgn, type ImportedGameInfo } from "../lib/pgn-import";
import {
  assessDifficulty,
  classifyMove,
  detectGamePhase,
  evalMatchesPosition,
} from "../lib/move-analysis";
import { useSettings } from "@/features/settings/SettingsContext";
import type { OptionSquares } from "../types";

const AI_ARROW_OPACITIES = [0.9, 0.65, 0.45, 0.3];

// Code-split into their own chunks rather than bundled into the main
// /board chunk - lets the browser fetch them in parallel with (instead
// of as part of) the board's own critical code. GameModeModal/
// BoardSettingsModal are still rendered unconditionally, same as before
// (they always were - Modal.tsx plays a close animation by staying
// mounted for a moment after `isOpen` flips false, which needs the
// component to already be in the tree the *first* time it opens too;
// gating that first render behind "has this ever been opened" briefly
// looked like a further win, but it races the chunk load itself - close
// it before the chunk finishes fetching and there's no listener mounted
// yet to catch that, so it opens "stuck" once the chunk does arrive).
// BoardPositionEditor has no such lifecycle (a plain ternary swap, not
// Modal-wrapped) - safe to also defer *when* it renders, which it
// already does via `isEditingPosition` below.
const GameModeModal = dynamic(() =>
  import("./GameModeModal").then((mod) => mod.GameModeModal),
);
const BoardSettingsModal = dynamic(() =>
  import("./BoardSettingsModal").then((mod) => mod.BoardSettingsModal),
);
const BoardPositionEditor = dynamic(() =>
  import("./BoardPositionEditor").then((mod) => mod.BoardPositionEditor),
);

// The same three tokens the panel's own sentiment border/badge use
// (accent/good/bad from globals.css) - "focus" for a plain point-of-
// interest, "good"/"bad" for something favorable or dangerous. Squares
// get a soft fill; arrows need more opacity to actually read as a
// stroke, hence the two separate maps off the same base colors.
const ANNOTATION_FILL: Record<AnnotationColor, string> = {
  focus: "rgba(91, 157, 250, 0.35)",
  good: "rgba(95, 191, 143, 0.35)",
  bad: "rgba(242, 104, 90, 0.35)",
};
const ANNOTATION_STROKE: Record<AnnotationColor, string> = {
  focus: "rgba(91, 157, 250, 0.85)",
  good: "rgba(95, 191, 143, 0.85)",
  bad: "rgba(242, 104, 90, 0.85)",
};

export function BoardScreen() {
  const {
    chessPosition,
    optionSquares,
    lastMoveSquares,
    checkSquares,
    illegalSquares,
    orientation,
    analysisFen,
    gameStatus,
    currentNode,
    currentLine,
    currentNodeId,
    canGoPrevious,
    canGoNext,
    toggleOrientation,
    changeOrientation,
    onSquareClick,
    resetBoard,
    loadTree,
    goToNode,
    goToStart,
    goToPrevious,
    undoMove,
    goToNext,
    goToEnd,
    isPlayingStockfish,
    playerSide,
    startAnalysis,
    startVsStockfish,
    tree,
  } = useBoardGameContext();

  const { isBoardSettingsOpen, openBoardSettings, closeBoardSettings } =
    useBoardSettings();

  const [isGameModeOpen, setIsGameModeOpen] = useState(false);
  const [gameModeStep, setGameModeStep] = useState<GameModeStep>("list");
  const [isEditingPosition, setIsEditingPosition] = useState(false);
  // Set once a PGN import succeeds, shown as a small banner above the
  // board until some other game-start action (a fresh Stockfish game, a
  // new setup position, another import) replaces it.
  const [importedGameInfo, setImportedGameInfo] = useState<ImportedGameInfo | null>(null);

  function openGameMode(step: GameModeStep) {
    setGameModeStep(step);
    setIsGameModeOpen(true);
  }

  const { settings } = useSettings();
  const {
    showEvalBar,
    showEvalScore,
    showEngineSuggestions,
    showCoordinates,
    coordinatesPlacement,
    showMoveList,
  } = settings;

  // --board-size drives width/height for the whole board-page composition
  // (chat panel, move-list row, board itself all share it). It's set from
  // 100dvh minus the actual fixed-pixel chrome around it - outer padding
  // (32px), AiChatPanel (112px), gaps (12px each), and the move-list row
  // (36px, always reserved so toggling it fades in place instead of
  // resizing/shifting the board) - so the page never grows taller than the
  // viewport and needs to scroll. Nothing is spent on the header: it's
  // `fixed` now (see SiteHeader), not `sticky`, so it never reserves a row
  // for `main` to sit below in the first place. The imported-game banner
  // is the one piece of chrome that isn't always there, so its ~40px
  // (row + gap) only comes off the budget while it's actually shown.
  const boardSizeValue = `min(90vw, calc(100dvh - ${importedGameInfo ? 244 : 204}px), 1100px)`;

  // Setting up a position swaps the chat panel out for two extra spare-piece
  // rows plus a toolbar row below the board - smaller and narrower than the
  // normal board size so that whole stack still fits one screen on desktop
  // instead of pushing the toolbar below the fold.
  const editorBoardSizeValue = "min(56vw, calc((100dvh - 180px) / 1.3), 560px)";

  // The Stockfish worker is a ~7MB WASM download - starting it the
  // instant this component mounts means it competes with the board's own
  // first paint for bandwidth/main-thread time. Deferring to the
  // browser's idle time (with a short timeout fallback for engines that
  // never go idle, and a plain setTimeout on browsers without
  // requestIdleCallback, e.g. Safari) lets the board render first; the
  // eval bar/AI coach still end up ready well before anyone's made a
  // move either way.
  const [engineEnabled, setEngineEnabled] = useState(false);
  useEffect(() => {
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(() => setEngineEnabled(true), { timeout: 1000 });
      return () => w.cancelIdleCallback?.(id);
    }
    const id = window.setTimeout(() => setEngineEnabled(true), 200);
    return () => window.clearTimeout(id);
  }, []);

  // The engine's own suggestions/eval reveal what it would play - each of
  // EvalBar's `visible`, EvalScoreLabel's `visible`, and aiArrows below
  // already independently hide themselves while Stockfish is the
  // opponent in an actual game, so evaluation itself always runs
  // regardless: the AI Coach panel wants it unconditionally (that's not
  // a hint about what to play next, just commentary on what already
  // happened), and gating the computation itself would starve it too.
  const evalFen = analysisFen || chessPosition;
  const evalScore = useEvalScore(evalFen, 14, engineEnabled);

  // The move that led to the position actually on screen - the current
  // node itself, never the end of whatever line it's part of. currentLine
  // walks forward to the branch's leaf (so the move list can still show
  // moves ahead of the cursor), which made this wrongly point at the
  // final move of an imported game (or any line with moves played beyond
  // the current one) instead of wherever navigation actually left off.
  const lastMove = currentNode.parentId ? currentNode : undefined;
  // useEvalScore's displayMate is relative to whoever moves next (positive
  // = that side delivers mate), not White - flip it to the same
  // White-relative convention displayScore already uses, so the coach
  // prompt can treat "positive/negative" consistently for both. depth is
  // 0 whenever no evaluation has run yet (analysis off, or too soon) -
  // that's the "no eval available" signal the coach prompt falls back on.
  const nextToMove = lastMove?.side === "w" ? "b" : "w";
  // depth > 0 alone isn't enough: useEvalScore's reset-and-research cycle
  // after a position change is a real Worker round-trip, not instant, so
  // for a window right after any move it can still be returning the
  // *previous* position's fully-converged (deep, plausible) data rather
  // than "nothing yet" - evalMatchesPosition catches that regardless of
  // how long the window lasts (see its own comment in move-analysis.ts).
  const hasEval = evalScore.depth > 0 && evalMatchesPosition(evalFen, evalScore.bestMove);
  const whiteMate =
    hasEval && evalScore.displayMate !== null
      ? nextToMove === "w"
        ? evalScore.displayMate
        : -evalScore.displayMate
      : null;
  const whiteCp = hasEval ? evalScore.displayScore : null;
  const humanSide: "w" | "b" | null = isPlayingStockfish
    ? playerSide === "white"
      ? "w"
      : "b"
    : null;

  // Move classification needs the eval from *before* the move (the best
  // achievable there) to compare against what actually happened -
  // useEvalScore only ever reflects whatever's on screen right now, so
  // every position's own eval is snapshotted here, by FEN, the moment it
  // becomes available. By the time a move is played, the parent's
  // snapshot is just a lookup - already computed while it was live,
  // however deep it got before the position moved on. Never cleared:
  // bounded by how many distinct positions a game can reach, not a
  // concern worth cleaning up.
  const evalSnapshotsRef = useRef(
    new Map<string, { whitePercent: number; candidates: typeof evalScore.candidates }>(),
  );
  useEffect(() => {
    if (!hasEval) return;
    evalSnapshotsRef.current.set(evalFen, {
      whitePercent: evalScore.whitePercent,
      candidates: evalScore.candidates,
    });
  }, [evalFen, hasEval, evalScore.whitePercent, evalScore.candidates]);

  const parentFen = lastMove ? tree.nodes[lastMove.parentId ?? ""]?.fen : undefined;
  const beforeSnapshot = parentFen ? evalSnapshotsRef.current.get(parentFen) : undefined;

  // The single source of truth for "was this move good" - computed once,
  // deterministically, from Stockfish's own eval swing (never asked of
  // the LLM - see move-analysis.ts). `null` whenever there isn't enough
  // data yet (no snapshot of the position before the move, e.g. it was
  // reached before any evaluation had a chance to run).
  const classification =
    beforeSnapshot && hasEval && lastMove
      ? classifyMove(beforeSnapshot.whitePercent, evalScore.whitePercent, lastMove.side ?? "w")
      : null;
  const difficulty = beforeSnapshot ? assessDifficulty(beforeSnapshot.candidates) : null;
  const phase = lastMove ? detectGamePhase(lastMove.fen, lastMove.ply) : null;
  const sanText = lastMove?.san ?? "";
  const isCapture = sanText.includes("x");
  const isCheck = /[+#]$/.test(sanText);
  const isCastle = sanText.startsWith("O-O");
  const matchesBest =
    beforeSnapshot && lastMove?.uci ? beforeSnapshot.candidates[0]?.move === lastMove.uci : null;

  const commentary = useMoveCommentary({
    nodeId: currentNodeId,
    fen: lastMove?.fen ?? chessPosition,
    san: lastMove?.san ?? null,
    moveNumber: lastMove?.moveNumber ?? 0,
    side: lastMove?.side ?? null,
    humanSide,
    cp: whiteCp,
    mate: whiteMate,
    bestMove: evalScore.bestMove,
    classification,
    phase,
    difficulty,
    isCapture,
    isCheck,
    isCastle,
    matchesBest,
  });

  // The eval chip/glyph read the same classification the coach's own
  // text is grounded in, rather than a separate ad hoc threshold - the
  // panel's color and the coach's words can't disagree with each other
  // if they're both reading the one verdict.
  const sentiment: CommentarySentiment =
    classification === "best" || classification === "good"
      ? "good"
      : classification === "mistake" || classification === "blunder"
        ? "bad"
        : "neutral";
  const evalLabel = hasEval
    ? formatEvalFromWhiteScore(whiteCp ?? 0, whiteMate)
    : `Move ${lastMove?.moveNumber ?? 0}`;

  // A one-shot message shown instead of the per-move commentary above,
  // for the two moments there's no move yet to comment on: a static
  // "make your move" notice right after a fresh vsStockfish game starts,
  // or a real coach description right after a custom position is set up
  // (see usePositionCommentary). Only ever relevant at the tree's root -
  // once any move is played, currentNodeId moves off it and the panel
  // falls back to the normal per-move commentary on its own.
  const positionCommentary = usePositionCommentary();
  const atRoot = currentNodeId === "root";
  useEffect(() => {
    if (!atRoot) positionCommentary.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atRoot]);
  const showPositionOverride = atRoot && positionCommentary.status !== "idle";
  const panelText = showPositionOverride ? positionCommentary.text : commentary.text;
  const panelStatus = showPositionOverride ? positionCommentary.status : commentary.status;
  const panelSentiment: CommentarySentiment = showPositionOverride ? "neutral" : sentiment;

  // A plain chess.js material check, not the LLM - runs instantly off
  // whatever position is on screen (no debounce, no network), so it
  // never misses an outright hang the way the coach's own commentary
  // sometimes does. See board-tactics.ts for exactly what counts.
  const hangingPieceSquares = useMemo<OptionSquares>(() => {
    const squares: OptionSquares = {};
    for (const { square } of detectHangingPieces(chessPosition)) {
      squares[square] = { backgroundColor: ANNOTATION_FILL.bad };
    }
    return squares;
  }, [chessPosition]);

  // The coach's own board annotation (see useMoveCommentary/api/coach) -
  // converted into the same shapes the board already renders highlights
  // and AI arrows in, so it needs no new rendering path, just a spot in
  // the existing merges below. Reads whichever of the two commentary
  // sources is actually showing (see showPositionOverride above), so a
  // position description's own annotation.points work exactly like a
  // move comment's do.
  const activeAnnotation = showPositionOverride
    ? positionCommentary.annotation
    : commentary.annotation;

  const coachHighlightSquares = useMemo<OptionSquares>(() => {
    const squares: OptionSquares = {};
    for (const { square, color } of activeAnnotation?.squares ?? []) {
      squares[square] = { backgroundColor: ANNOTATION_FILL[color] };
    }
    return squares;
  }, [activeAnnotation]);

  const coachArrows = useMemo<Arrow[]>(
    () =>
      (activeAnnotation?.arrows ?? []).map((arrow) => ({
        startSquare: arrow.from,
        endSquare: arrow.to,
        color: ANNOTATION_STROKE[arrow.color ?? "focus"],
      })),
    [activeAnnotation],
  );

  // Stockfish's top candidate moves (MultiPV) rendered as AI-drawn arrows,
  // in blue to stay distinct from user-drawn ones (library default #ffaa00).
  // Shows the full leading cluster of moves that are within ~half a pawn of
  // the best move (typically 3-4 in a close position), trimming down to
  // just the best 1-2 once there's a clear gap.
  const aiArrows = useMemo<Arrow[]>(() => {
    if (!showEngineSuggestions || isPlayingStockfish) return [];

    const ranked = evalScore.candidates.filter(
      (candidate): candidate is CandidateMove => candidate !== undefined,
    );
    const shown = selectCloseCandidates(ranked);

    return shown.map((candidate, index) => ({
      startSquare: candidate.move.slice(0, 2),
      endSquare: candidate.move.slice(2, 4),
      color: `rgba(59, 130, 246, ${AI_ARROW_OPACITIES[index] ?? 0.3})`,
    }));
  }, [evalScore.candidates, showEngineSuggestions, isPlayingStockfish]);

  // Give the final move/highlight a moment to settle on the board before
  // covering it with the result.
  useEffect(() => {
    if (!gameStatus.isOver) return;

    const timeout = setTimeout(() => openGameMode("list"), 500);
    return () => clearTimeout(timeout);
  }, [gameStatus.isOver]);

  // The human always plays whoever's actually to move in the position the
  // game starts from - a fresh game means the standard start, so always
  // White; a custom setup position can mean either. No side picker to
  // keep in sync with that - just a chat notice once the game begins.
  function announceVsStockfish(side: "white" | "black") {
    positionCommentary.showStatic(
      `You're playing ${side === "white" ? "White" : "Black"}. Make your move - Stockfish will play ${
        side === "white" ? "Black" : "White"
      } for the rest of the game.`,
    );
  }

  function handleStartVsStockfish(skillLevel: number) {
    setImportedGameInfo(null);
    resetBoard();
    startVsStockfish("white", skillLevel);
    changeOrientation("white");
    announceVsStockfish("white");
  }

  function handleEditorAnalyze(fen: string) {
    setImportedGameInfo(null);
    resetBoard(fen);
    startAnalysis();
    setIsEditingPosition(false);
    positionCommentary.describePosition(fen, null);
  }

  function handleEditorPlayVsStockfish(fen: string) {
    setImportedGameInfo(null);
    const side: "white" | "black" = new Chess(fen).turn() === "b" ? "black" : "white";
    resetBoard(fen);
    startVsStockfish(side, 10);
    changeOrientation(side);
    setIsEditingPosition(false);
    positionCommentary.describePosition(fen, side === "white" ? "w" : "b");
  }

  // Returns an error message on malformed PGN (kept on-screen in the
  // modal so the pasted text can be fixed), or null on success.
  function handleImportGame(pgn: string): string | null {
    let result: ReturnType<typeof importPgn>;
    try {
      result = importPgn(pgn);
    } catch {
      return "That doesn't look like a valid PGN.";
    }
    loadTree(result.tree);
    startAnalysis();
    changeOrientation("white");
    setImportedGameInfo(result.info);
    return null;
  }

  return (
    <>
      <div className="flex w-full flex-1 flex-col items-center justify-center gap-3 overflow-x-auto p-3 sm:p-4">
        <div
          className="flex w-(--board-size) flex-col gap-3"
          style={
            {
              "--board-size": isEditingPosition
                ? editorBoardSizeValue
                : boardSizeValue,
            } as React.CSSProperties
          }
        >
          {!isEditingPosition && importedGameInfo && (
            <div className="flex w-full items-center justify-between gap-2 rounded border border-border-soft bg-surface px-3 py-1.5 text-xs text-text-dim">
              <span className="truncate">
                <span className="font-medium text-text">{importedGameInfo.white}</span>
                {importedGameInfo.whiteElo && ` (${importedGameInfo.whiteElo})`}
                {" vs "}
                <span className="font-medium text-text">{importedGameInfo.black}</span>
                {importedGameInfo.blackElo && ` (${importedGameInfo.blackElo})`}
              </span>
              <span className="shrink-0 font-mono">
                {importedGameInfo.result}
                {importedGameInfo.timeControl && ` · ${importedGameInfo.timeControl}`}
              </span>
            </div>
          )}

          {!isEditingPosition && (
            <AiChatPanel
              moveNumber={lastMove?.moveNumber ?? 0}
              text={panelText}
              status={panelStatus}
              sentiment={panelSentiment}
              evalLabel={evalLabel}
            />
          )}

          {isEditingPosition ? (
            <div className="flex w-full items-center justify-center gap-2">
              <BoardPositionEditor
                initialFen={chessPosition}
                onAnalyze={handleEditorAnalyze}
                onPlayVsStockfish={handleEditorPlayVsStockfish}
                onCancel={() => setIsEditingPosition(false)}
              />

              {/* Desktop only - see the mobile copy below for why this one is
                  hidden there instead. */}
              <div className="hidden sm:contents">
                <BoardControls
                  openBoardSettings={openBoardSettings}
                  openStockfishSetup={() => openGameMode("stockfish")}
                  openPositionSetup={() => setIsEditingPosition(true)}
                  openImportGame={() => openGameMode("import")}
                  openAiCoach={() => openGameMode("ai-coach")}
                  openPuzzles={() => openGameMode("puzzles")}
                  onAnalysis={startAnalysis}
                  onUndo={undoMove}
                  toggleOrientation={toggleOrientation}
                />
              </div>
            </div>
          ) : (
            <div className="flex h-(--board-size) w-full gap-2">
              <EvalBar
                visible={showEvalBar && !isPlayingStockfish}
                whitePercent={evalScore.whitePercent}
                depth={evalScore.depth}
                bestMove={evalScore.bestMove}
              />

              <BoardView
                chessPosition={chessPosition}
                orientation={orientation}
                optionSquares={{
                  ...lastMoveSquares,
                  ...hangingPieceSquares,
                  ...coachHighlightSquares,
                  ...checkSquares,
                  ...optionSquares,
                  ...illegalSquares,
                }}
                onSquareClick={onSquareClick}
                showCoordinates={showCoordinates}
                coordinatesPlacement={coordinatesPlacement}
                aiArrows={[...aiArrows, ...coachArrows]}
              />

              {/* Desktop only - no side column to put a tall icon stack in on
                  mobile, so it moves below the move list there instead (see
                  the row-layout copy further down). `contents` keeps this
                  wrapper out of the flex layout entirely, so BoardControls
                  sits exactly as if it were BoardView's direct sibling. */}
              <div className="hidden sm:contents">
                <BoardControls
                  openBoardSettings={openBoardSettings}
                  openStockfishSetup={() => openGameMode("stockfish")}
                  openPositionSetup={() => setIsEditingPosition(true)}
                  openImportGame={() => openGameMode("import")}
                  openAiCoach={() => openGameMode("ai-coach")}
                  openPuzzles={() => openGameMode("puzzles")}
                  onAnalysis={startAnalysis}
                  onUndo={undoMove}
                  toggleOrientation={toggleOrientation}
                />
              </div>
            </div>
          )}

          {/* Not rendered at all while editing (rather than just faded out
              like the showMoveList toggle below) - there's no move list to
              show mid-edit, and reserving its row's height would throw off
              centering the editor on the page. */}
          {!isEditingPosition && (
            <div
              className={`flex h-9 w-full items-center gap-2 transition-opacity duration-200 ease-out ${
                showMoveList ? "opacity-100" : "pointer-events-none opacity-0"
              }`}
            >
              <EvalScoreLabel
                visible={showEvalScore && !isPlayingStockfish}
                displayScore={evalScore.displayScore}
                displayMate={evalScore.displayMate}
              />

              <div className="min-w-0 flex-1">
                <MoveList
                  currentLine={currentLine}
                  currentNodeId={currentNodeId}
                  onSelectNode={goToNode}
                  onSelectStart={goToStart}
                />
              </div>

              <MoveNavigation
                canGoPrevious={canGoPrevious}
                canGoNext={canGoNext}
                onStart={goToStart}
                onPrevious={goToPrevious}
                onNext={goToNext}
                onEnd={goToEnd}
              />
            </div>
          )}

          {/* Mobile only - the desktop side column above is hidden here. */}
          <div className="sm:hidden">
            <BoardControls
              layout="row"
              openBoardSettings={openBoardSettings}
              openStockfishSetup={() => openGameMode("stockfish")}
              openPositionSetup={() => setIsEditingPosition(true)}
              openImportGame={() => openGameMode("import")}
              openAiCoach={() => openGameMode("ai-coach")}
              openPuzzles={() => openGameMode("puzzles")}
              onAnalysis={startAnalysis}
              onUndo={undoMove}
              toggleOrientation={toggleOrientation}
            />
          </div>
        </div>
      </div>

      <BoardSettingsModal
        isOpen={isBoardSettingsOpen}
        onClose={closeBoardSettings}
      />

      <GameModeModal
        isOpen={isGameModeOpen}
        onClose={() => setIsGameModeOpen(false)}
        initialStep={gameModeStep}
        onStartVsStockfish={handleStartVsStockfish}
        onOpenBoardEditor={() => setIsEditingPosition(true)}
        onImportGame={handleImportGame}
        gameStatus={gameStatus}
      />
    </>
  );
}
