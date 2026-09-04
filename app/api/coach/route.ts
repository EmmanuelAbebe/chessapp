import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { createOpenAI } from "@ai-sdk/openai";
import { stepCountIs, streamText, tool, type LanguageModel } from "ai";
import { z } from "zod";
import {
  DEFAULT_MODEL_BY_PROVIDER,
  type AiProvider,
} from "@/features/settings/ai-provider-types";

type MoveClassification = "best" | "good" | "inaccuracy" | "mistake" | "blunder";
type GamePhase = "opening" | "middlegame" | "endgame";
type Difficulty = "critical" | "normal" | "flexible";

type CoachRequest = {
  // "move" (default) - comment on the move just played, as before.
  // "position" - describe a freshly set-up position instead: no move has
  // been played yet, so none of the per-move fields below apply.
  mode?: "move" | "position";
  fen: string;
  san: string;
  moveNumber: number;
  side: "w" | "b";
  cp: number | null;
  mate: number | null;
  bestMove: string | null;
  // Which color the human is playing when this is a game against
  // Stockfish - null in analysis/freeform mode, where both sides are the
  // person exploring the board and "you" is unambiguous either way.
  humanSide: "w" | "b" | null;
  // Everything below is computed deterministically on the client
  // (move-analysis.ts, from Stockfish eval swings and chess.js facts,
  // never from the LLM) - the model's only job is to phrase these, never
  // to decide them. `null` wherever there wasn't enough data yet.
  classification: MoveClassification | null;
  phase: GamePhase | null;
  difficulty: Difficulty | null;
  isCapture: boolean;
  isCheck: boolean;
  isCastle: boolean;
  matchesBest: boolean | null;
  // Bring-your-own provider/key (features/settings/useAiProviderConfig.ts) -
  // an empty/missing apiKey falls back to this server's own env var, but
  // only for "google", the only provider with one.
  provider: AiProvider;
  apiKey: string;
  model: string;
};

/** Builds the actual model client for whichever provider the request
 * asked for, using the caller's own key - `null` if there's no usable
 * key at all (no user key, and, for anything but "google", no env var
 * to fall back to either). Never logs the key; it only ever passes
 * through this function on its way to the provider's own SDK client. */
function resolveModel(
  provider: AiProvider,
  apiKey: string,
  model: string,
): LanguageModel | null {
  const modelId = model || DEFAULT_MODEL_BY_PROVIDER[provider];
  const key = apiKey || undefined;

  switch (provider) {
    case "google": {
      // The only provider with a server-side fallback - createGoogleGenerativeAI
      // reads GOOGLE_GENERATIVE_AI_API_KEY itself when apiKey is undefined.
      if (!key && !process.env.GOOGLE_GENERATIVE_AI_API_KEY) return null;
      return createGoogleGenerativeAI({ apiKey: key })(modelId);
    }
    case "openai":
      return key ? createOpenAI({ apiKey: key })(modelId) : null;
    case "anthropic":
      return key ? createAnthropic({ apiKey: key })(modelId) : null;
    case "groq":
      return key ? createGroq({ apiKey: key })(modelId) : null;
    default:
      return null;
  }
}

// A square/arrow color name, not a hex value - the client maps each to
// the same design-system token its own sentiment coloring already uses
// (accent/good/bad), so a coach-drawn "bad" square reads the same as the
// panel's own "bad" left edge.
const AnnotationColor = z.enum(["focus", "good", "bad"]);

const annotateBoardInput = z.object({
  squares: z
    .array(
      z.object({
        square: z.string().describe("e.g. 'e5'"),
        color: AnnotationColor,
      }),
    )
    .max(4)
    .optional(),
  arrows: z
    .array(
      z.object({
        from: z.string(),
        to: z.string(),
        color: AnnotationColor.optional(),
      }),
    )
    .max(3)
    .optional(),
});
type AnnotateBoardInput = z.infer<typeof annotateBoardInput>;

const annotateBoard = tool({
  description:
    "Highlight squares and/or draw arrows on the board to point out a plan, outpost, or key square/piece relationship your comment mentions. Hanging pieces are already highlighted automatically elsewhere - don't use this tool just to flag one. Use only when the comment names something specific enough to point at; skip it otherwise.",
  inputSchema: annotateBoardInput,
  // A trivial ack, not real work - its only purpose is to give the model
  // a tool *result* to react to. This model calls tools and writes prose
  // as mutually exclusive within a single step (observed directly:
  // forcing a bare tool call produces zero accompanying text), so
  // without a result to continue from, calling this tool would silently
  // swallow the entire comment. `stopWhen: stepCountIs(2)` below lets the
  // model take a second step after seeing this result, where it's free
  // to write the actual commentary.
  execute: async () => ({ shown: true }),
});

const SYSTEM_PROMPT = `You are a friendly, concise chess coach watching a
live game. After each move, give a single short coaching comment - at
most two short sentences, no more than about 30 words total.

Every move comes with a pre-computed classification - best, good,
inaccuracy, mistake, or blunder - already decided by a chess engine
comparing the position before and after the move. This is ground truth.
Do not re-judge the move yourself, do not soften or contradict it, and
never use language from a different tier than the one given:
- "best": the engine's own top choice (or equally good) - affirm it
  confidently, no hedging.
- "good": solid and sensible - mildly positive, matter-of-fact.
- "inaccuracy": a small slip - point out what would have been slightly
  better without being harsh about it.
- "mistake": a real error that gives up a meaningful advantage - say so
  plainly and name what it costs.
- "blunder": a serious error - state clearly what was lost and why;
  don't soften it or call it "aggressive" or "interesting" instead.
If classification is missing, comment qualitatively on the move instead
of inventing a numeric or tier judgment.

The move's game phase changes what's worth talking about:
- "opening": focus on development, center control, king safety, and
  tempo - not deep tactics.
- "middlegame": focus on piece activity, weak squares/outposts, and
  tactical motifs (pins, forks, hanging pieces, attacks).
- "endgame": focus on king activity, pawn structure, and technique.

If difficulty is "critical", this was the only move keeping the
position together - it's fine to say so ("the only move that worked
here"). If "flexible", several moves were about equally fine - you may
mention that, but don't force it. Say nothing about difficulty if it's
"normal" or missing.

Each prompt tells you who made the move just played - either "you" or
the opponent by name. When it's the opponent's move, don't praise or
blame "you" for it - describe what the opponent's move threatens or
allows, and what it means for the human's own next move. Only address
"you" directly for a move the human actually made. Don't repeat the move
notation back verbatim as if reading it aloud - describe what it does.

If your comment calls out a specific square, piece, or attacking
relationship, also call annotateBoard to point at it - "focus" for a
square worth noticing, "good" for something favorable, "bad" for a
weakness or danger. Keep it to 1-3 squares/arrows and only when it adds
real clarity; most routine moves don't need it at all. Always still
write your actual coaching comment as text too, whether or not you also
call annotateBoard - the annotation points, it doesn't replace the
explanation.`;

const SYSTEM_PROMPT_POSITION = `You are a friendly, concise chess coach. A
position has just been set up on the board (no move has been played in
it yet). In at most three short sentences (about 45 words total),
describe the position: the material balance if it's uneven, the key
features worth noticing (king safety, weak squares, passed pawns, piece
activity, an available tactic), and what's actually critical to work out
here. Sound like you're orienting a student who just sat down at this
position, not reciting a computer readout - never mention centipawns or
engine lines.

If you're told the human will be playing a specific color against
Stockfish, end with a short, separate sentence naming their color and
that Stockfish plays the other side - do not fold it into the analysis
sentence.

If a specific square, piece, or relationship is worth pointing at, call
annotateBoard the same way you would for a move comment. Always still
write the actual description as text too.`;

export async function POST(request: Request) {
  let body: Partial<CoachRequest>;
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  const {
    mode,
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
    provider,
    apiKey,
    model: modelId,
  } = body;
  const isPositionMode = mode === "position";
  if (!fen || (!isPositionMode && !san)) {
    return new Response("Missing 'fen' or 'san'", { status: 400 });
  }

  // Resolved explicitly rather than left for the provider's own SDK to
  // discover a missing key: that only surfaces once the stream is
  // already being consumed (after this handler has already returned a
  // 200 with an open body), which the client can't distinguish from a
  // real empty response.
  const resolvedProvider = provider ?? "google";
  const model = resolveModel(resolvedProvider, apiKey ?? "", modelId ?? "");
  if (!model) {
    return new Response(
      resolvedProvider === "google"
        ? "No Google API key configured - add your own in Settings, or set GOOGLE_GENERATIVE_AI_API_KEY on the server."
        : `No API key configured for ${resolvedProvider} - add one in Settings.`,
      { status: 400 },
    );
  }

let prompt: string;
  let systemPrompt: string;

  if (isPositionMode) {
    const sideLine =
      humanSide != null
        ? `\nThe human will play ${humanSide === "w" ? "White" : "Black"} against Stockfish, which plays the other side.`
        : "";
    systemPrompt = SYSTEM_PROMPT_POSITION;
    prompt = `Position just set up (FEN): ${fen}${sideLine}

Describe this position and what's key to it.`;
  } else {
    const evalLine =
      cp == null && mate == null
        ? "Engine evaluation: not available."
        : `Engine evaluation after this move (positive favors White, negative favors Black): ${
            mate != null
              ? `mate in ${Math.abs(mate)} for ${mate > 0 ? "White" : "Black"}`
              : `${(cp! / 100).toFixed(2)} pawns`
          }${bestMove ? `. Engine's suggested next move: ${bestMove}.` : ""}`;

    const isOpponentMove = humanSide != null && side != null && humanSide !== side;
    const mover = isOpponentMove ? "The opponent (Stockfish)" : "You";

    const moveType =
      [isCastle && "castling", isCapture && "a capture", isCheck && "check"]
        .filter(Boolean)
        .join(", ") || "a quiet move";

    const factsLine = `Classification: ${classification ?? "unknown"}
Game phase: ${phase ?? "unknown"}
Difficulty of finding a good move here: ${difficulty ?? "unknown"}
Move type: ${moveType}
Matches the engine's own top choice: ${matchesBest == null ? "unknown" : matchesBest ? "yes" : "no"}`;

    systemPrompt = SYSTEM_PROMPT;
    prompt = `${mover} just played move ${moveNumber ?? "?"}${side === "b" ? "..." : "."} ${san}.
Resulting position (FEN): ${fen}
${evalLine}
${factsLine}

Give your coaching comment on this move.`;
  }

  const result = streamText({
    model,
    system: systemPrompt,
    prompt,
    tools: { annotateBoard },
    // Allows (never forces) a second step: one where the model calls
    // annotateBoard, followed by one where it writes the actual comment
    // having "seen" that result - see the tool's own comment for why.
    // Responses with no tool call stop after the first step regardless,
    // same as before.
    stopWhen: stepCountIs(2),
    // Errors during generation - logged here since, once the NDJSON
    // stream below has started, there's no HTTP status left to report
    // them with (see the client's own "empty stream = error" handling).
    onError: ({ error }) => {
      console.error("[api/coach] stream error:", error);
    },
  });

  // A small custom newline-delimited-JSON protocol - not the full
  // ai/react UI-message stream, since this isn't a multi-turn chat: just
  // enough structure to carry the streamed prose plus an optional board
  // annotation in one response, decodable with a plain fetch + reader on
  // the client (see useMoveCommentary.ts).
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const part of result.fullStream) {
          if (part.type === "text-delta") {
            controller.enqueue(
              encoder.encode(JSON.stringify({ type: "text", text: part.text }) + "\n"),
            );
          } else if (part.type === "tool-call" && part.toolName === "annotateBoard") {
            const args = part.input as AnnotateBoardInput;
            controller.enqueue(
              encoder.encode(JSON.stringify({ type: "annotate", ...args }) + "\n"),
            );
          }
        }
      } catch (error) {
        console.error("[api/coach] stream iteration error:", error);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8" },
  });
}
