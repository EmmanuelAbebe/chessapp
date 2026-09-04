"use client";

import { useRef, useState } from "react";
import { useAiProviderConfig } from "@/features/settings/useAiProviderConfig";
import type { BoardAnnotation, CommentaryStatus } from "./useMoveCommentary";

type PositionCommentaryState = {
  text: string;
  status: CommentaryStatus;
  annotation: BoardAnnotation | null;
};

const IDLE: PositionCommentaryState = { text: "", status: "idle", annotation: null };

/** A one-shot sibling to useMoveCommentary for the two moments there's no
 * move to comment on yet: right after a custom position is set up (a real
 * /api/coach call, describing the position instead of a move - see the
 * route's "position" mode), and right after a fresh vsStockfish game
 * starts (a plain client-side string, no call needed - there's nothing on
 * the board yet to describe). No queue/slot juggling like the per-move
 * hook needs: this only ever fires once per setup event, never in a burst.
 */
export function usePositionCommentary() {
  const [state, setState] = useState<PositionCommentaryState>(IDLE);

  const { config: providerConfig } = useAiProviderConfig();
  const providerConfigRef = useRef(providerConfig);
  providerConfigRef.current = providerConfig;

  const controllerRef = useRef<AbortController | null>(null);

  function showStatic(text: string) {
    controllerRef.current?.abort();
    setState({ text, status: "done", annotation: null });
  }

  function reset() {
    controllerRef.current?.abort();
    setState(IDLE);
  }

  async function describePosition(fen: string, humanSide: "w" | "b" | null) {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setState({ text: "", status: "loading", annotation: null });

    const provider = providerConfigRef.current;

    try {
      const response = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "position",
          fen,
          humanSide,
          provider: provider.provider,
          apiKey: provider.apiKey,
          model: provider.model,
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
          setState({ text: full, status: "streaming", annotation: lastAnnotation });
        }
      }

      setState(
        full.trim() === ""
          ? { text: "", status: "error", annotation: null }
          : { text: full, status: "done", annotation: lastAnnotation },
      );
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        setState({ text: "", status: "error", annotation: null });
      }
    }
  }

  return { ...state, describePosition, showStatic, reset };
}
