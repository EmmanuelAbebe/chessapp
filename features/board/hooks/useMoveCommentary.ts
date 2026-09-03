"use client";

import { useEffect, useRef, useState } from "react";
import type { Difficulty, GamePhase, MoveClassification } from "../lib/move-analysis";

export type CommentaryStatus = "idle" | "loading" | "streaming" | "done" | "error";

export type AnnotationColor = "focus" | "good" | "bad";

export type BoardAnnotation = {
  squares?: { square: string; color: AnnotationColor }[];
  arrows?: { from: string; to: string; color?: AnnotationColor }[];
};

type MoveCommentaryInput = {
  nodeId: string;
  fen: string;
  san: string | null;
  moveNumber: number;
  side: "w" | "b" | null;
  cp: number | null;
  mate: number | null;
  bestMove: string | null;
  // Which color the human is playing, when playing against Stockfish -
  // null in analysis/freeform mode. Lets the coach tell "you played this"
  // apart from "the opponent played this".
  humanSide: "w" | "b" | null;
  // Everything below is computed deterministically (move-analysis.ts,
  // board-tactics.ts) before this ever reaches the LLM - the model's job
  // is to phrase these, never to decide them itself. `null` wherever
  // there wasn't enough data yet (e.g. no eval snapshot of the position
  // before the move).
  classification: MoveClassification | null;
  phase: GamePhase | null;
  difficulty: Difficulty | null;
  isCapture: boolean;
  isCheck: boolean;
  isCastle: boolean;
  matchesBest: boolean | null;
};

type NodeCommentary = {
  text: string;
  status: CommentaryStatus;
  annotation: BoardAnnotation | null;
};

// Stepping through several moves quickly (arrow keys, the move list, the
// map) shouldn't fire a request per move landed on along the way - only
// once a node has actually stuck around for a moment is it worth the
// network call. Also doubles as breathing room for Stockfish: stopping
// whatever it was searching on the previous position and reporting even
// a shallow depth on the new one isn't instant, and the classification
// this feeds (move-analysis.ts) is only as good as the depth reached by
// the time this fires.
const DEBOUNCE_MS = 600;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

// How long a finished comment stays on screen before a newer one is
// allowed to replace it - scaled to its own length (a one-line comment
// doesn't need 8 seconds; a longer one needs more than 3) rather than a
// single fixed delay.
function holdDurationMs(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return clamp(words * 350, 3000, 8000);
}

/** Streams a short AI coaching comment for the current move from
 * /api/coach, caching finished comments (and any board annotation that
 * came with them) by node id so navigating back to an already-commented
 * move shows both instantly instead of re-fetching.
 *
 * A fast-replying opponent (Stockfish) can advance the current node well
 * before a slower LLM has finished commenting on the *previous* one - two
 * separate problems if left alone: an already-finished comment getting
 * swapped out before anyone's read it, and (worse) a comment that hasn't
 * finished yet losing its chance to ever be shown at all, since the panel
 * would otherwise already be tracking the newer node by the time it's
 * ready. Both are handled the same way here: at most one node "owns" the
 * display (the slot) at a time, and at most one more waits behind it (the
 * queue - only the latest arrival survives being queued, so a burst of
 * moves doesn't pile up a backlog); a new node only takes the slot
 * immediately if nothing is currently in flight for it. Every node's own
 * fetch, once actually started, always runs to completion and gets
 * cached regardless of what the slot/queue later do with it - nothing is
 * ever aborted just because navigation moved on, only on unmount.
 */
export function useMoveCommentary({
  nodeId,
  fen,
  san,
  moveNumber,
  side,
  cp,
  mate,
  bestMove,
  humanSide,
  classification,
  phase,
  difficulty,
  isCapture,
  isCheck,
  isCastle,
  matchesBest,
}: MoveCommentaryInput): NodeCommentary {
  const [display, setDisplay] = useState<NodeCommentary>({
    text: "",
    status: "idle",
    annotation: null,
  });

  // Every node's latest known state, live-updated as its own fetch
  // progresses - doubles as the "already computed" cache once a node
  // reaches done/error (or idle, for a root/no-move node).
  const resultsRef = useRef(new Map<string, NodeCommentary>());
  const debounceTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const controllersRef = useRef(new Map<string, AbortController>());

  // Kept fresh on every render (a plain assignment below, not inside an
  // effect - no re-render of its own, just always readable) - the eval-
  // derived fields (cp/mate/classification/etc.) are still evolving as
  // Stockfish deepens on whatever position is now current, so the actual
  // fetch (fired from a debounce timer, well after the render that first
  // saw this nodeId) needs to read them at *send* time, not whatever they
  // happened to be the instant the node became current - otherwise the
  // debounce buys time but the request still ships with the position's
  // pre-move eval, since that's all that existed when the closure below
  // was created.
  const latestFieldsRef = useRef<Omit<MoveCommentaryInput, "nodeId">>({
    fen,
    san,
    moveNumber,
    side,
    cp,
    mate,
    bestMove,
    humanSide,
    classification,
    phase,
    difficulty,
    isCapture,
    isCheck,
    isCastle,
    matchesBest,
  });
  latestFieldsRef.current = {
    fen,
    san,
    moveNumber,
    side,
    cp,
    mate,
    bestMove,
    humanSide,
    classification,
    phase,
    difficulty,
    isCapture,
    isCheck,
    isCastle,
    matchesBest,
  };

  const slotIdRef = useRef<string | null>(null);
  const nextIdRef = useRef<string | null>(null);
  // True from the moment a real fetch starts for the slot's node until
  // it's either failed or finished *and* had its own reading time - i.e.
  // "something is holding the slot; don't hand it to a new node yet."
  const busyRef = useRef(false);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showIfSlot(id: string, data: NodeCommentary) {
    if (slotIdRef.current !== id) return;
    setDisplay(data);
    if (data.status === "done") {
      scheduleRelease(holdDurationMs(data.text));
    } else if (data.status === "error") {
      release();
    }
    // "loading"/"streaming" - stays busy, nothing scheduled yet.
  }

  function scheduleRelease(delayMs: number) {
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    holdTimerRef.current = setTimeout(release, delayMs);
  }

  function release() {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    busyRef.current = false;
    if (nextIdRef.current) promote(nextIdRef.current);
  }

  function promote(id: string) {
    slotIdRef.current = id;
    nextIdRef.current = null;
    const result = resultsRef.current.get(id) ?? {
      text: "",
      status: "loading" as CommentaryStatus,
      annotation: null,
    };
    busyRef.current = result.status === "loading" || result.status === "streaming";
    setDisplay(result);
    if (result.status === "done") scheduleRelease(holdDurationMs(result.text));
  }

  function ensureFetch(id: string, params: Omit<MoveCommentaryInput, "nodeId">) {
    if (resultsRef.current.has(id)) return;

    if (!params.san) {
      resultsRef.current.set(id, { text: "", status: "idle", annotation: null });
      return;
    }

    resultsRef.current.set(id, { text: "", status: "loading", annotation: null });

    const timer = setTimeout(async () => {
      debounceTimersRef.current.delete(id);
      // Only worth a network call if this node is still either on screen
      // or queued to be next - otherwise it was just passed through
      // during fast navigation. Drop its placeholder too, so revisiting
      // it later (e.g. via the move list) starts a fresh attempt instead
      // of getting stuck on a "loading" that was actually abandoned.
      if (slotIdRef.current !== id && nextIdRef.current !== id) {
        resultsRef.current.delete(id);
        return;
      }

      const controller = new AbortController();
      controllersRef.current.set(id, controller);

      // Read fresh, not from `params` - see latestFieldsRef's own comment
      // for why the debounce alone doesn't make `params` safe to use here.
      const fields = latestFieldsRef.current;

      try {
        const response = await fetch("/api/coach", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fen: fields.fen,
            san: fields.san,
            moveNumber: fields.moveNumber,
            side: fields.side,
            cp: fields.cp,
            mate: fields.mate,
            bestMove: fields.bestMove,
            humanSide: fields.humanSide,
            classification: fields.classification,
            phase: fields.phase,
            difficulty: fields.difficulty,
            isCapture: fields.isCapture,
            isCheck: fields.isCheck,
            isCastle: fields.isCastle,
            matchesBest: fields.matchesBest,
          }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error(`Coach request failed: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let full = "";
        let lastAnnotation: BoardAnnotation | null = null;
        // The server writes one JSON object per line - a chunk boundary
        // can land mid-line, so buffer whatever's left after the last
        // complete "\n" until more bytes arrive.
        let buffer = "";

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line) continue;
            const part = JSON.parse(line) as
              | { type: "text"; text: string }
              | ({ type: "annotate" } & BoardAnnotation);
            if (part.type === "text") {
              full += part.text;
            } else {
              const { type: _type, ...rest } = part;
              lastAnnotation = rest;
            }
            const next: NodeCommentary = { text: full, status: "streaming", annotation: lastAnnotation };
            resultsRef.current.set(id, next);
            showIfSlot(id, next);
          }
        }

        // A stream that finishes with no text at all is never a real
        // answer (even a one-word comment is non-empty) - it means the
        // provider errored after the response had already started, which
        // can't be reported as an HTTP status at that point (see the
        // route's own onError comment).
        const final: NodeCommentary =
          full.trim() === ""
            ? { text: "", status: "error", annotation: null }
            : { text: full, status: "done", annotation: lastAnnotation };
        resultsRef.current.set(id, final);
        showIfSlot(id, final);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          const errorResult: NodeCommentary = { text: "", status: "error", annotation: null };
          resultsRef.current.set(id, errorResult);
          showIfSlot(id, errorResult);
        }
      } finally {
        controllersRef.current.delete(id);
      }
    }, DEBOUNCE_MS);

    debounceTimersRef.current.set(id, timer);
  }

  useEffect(() => {
    ensureFetch(nodeId, {
      fen,
      san,
      moveNumber,
      side,
      cp,
      mate,
      bestMove,
      humanSide,
      classification,
      phase,
      difficulty,
      isCapture,
      isCheck,
      isCastle,
      matchesBest,
    });

    if (slotIdRef.current === nodeId) {
      // Already the active (or freshly-idle) slot - nothing to change.
    } else if (!busyRef.current) {
      promote(nodeId);
    } else {
      nextIdRef.current = nodeId;
    }
    // fen/moveNumber/side/cp/mate/bestMove/humanSide are all derived from
    // nodeId - re-running only on nodeId change is sufficient, and avoids
    // re-triggering e.g. when the eval score ticks up a depth for the
    // same position.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId]);

  // Nothing is ever aborted just because navigation moved past it (see
  // ensureFetch above) - only tear everything down once, on unmount.
  useEffect(() => {
    return () => {
      for (const timer of debounceTimersRef.current.values()) clearTimeout(timer);
      for (const controller of controllersRef.current.values()) controller.abort();
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    };
  }, []);

  return display;
}
