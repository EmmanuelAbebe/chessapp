import { generateObject } from "ai";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveModel } from "@/lib/ai/resolveModel";
import { requireLichessLink } from "@/features/lichess/api";
import { fetchChessComPgn, requireChessComUsername } from "@/features/chesscom/api";
import type { AiProvider } from "@/features/settings/ai-provider-types";

// Shared between the single-shot /api/player-profile route and the
// chunked /api/player-profile/jobs routes - fetching games, sizing the
// request, and filling in coaching text are identical either way; only
// how the ml service's response comes back (once vs. polled) differs.

export const MAX_GAMES_FLOOR = 10;
export const MAX_GAMES_FALLBACK = 60; // used only when the user has no imported history to size from
// Not a UX limit (the client warns past this in AnalyzePanel) - just a
// hard backstop so a stray/malicious maxGames can't ask this route to hold
// an unbounded PGN string in memory or send an unbounded body to the ml
// service. Comfortably above anything a real request should ever need.
export const MAX_GAMES_SAFETY_CEILING = 5000;

export async function resolveMaxGames(userId: string, requested: number | undefined): Promise<number> {
  let maxGames: number;
  if (typeof requested === "number" && Number.isFinite(requested)) {
    maxGames = requested;
  } else {
    const importedCount = await prisma.gameRecord.count({ where: { userId } });
    maxGames = importedCount || MAX_GAMES_FALLBACK;
  }
  return Math.round(Math.min(MAX_GAMES_SAFETY_CEILING, Math.max(MAX_GAMES_FLOOR, maxGames)));
}

export async function fetchUserPgn(
  token: string,
  username: string,
  timeClass: string,
  max: number,
): Promise<string> {
  const url = new URL(`https://lichess.org/api/games/user/${encodeURIComponent(username)}`);
  url.searchParams.set("max", String(max));
  url.searchParams.set("perfType", timeClass);
  url.searchParams.set("rated", "true");
  url.searchParams.set("evals", "true");
  url.searchParams.set("clocks", "true");
  url.searchParams.set("opening", "true");

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/x-chess-pgn" },
  });
  if (!res.ok) throw new Error(`Lichess export failed: ${res.status}`);
  return res.text();
}

export type GamesSource = "lichess" | "chesscom";

/** Resolves which connected account `source` names and fetches its recent
 * games as PGN - both player-profile routes (single-shot and jobs) share
 * this so "lichess" vs "chesscom" branches identically either way. Throws
 * LichessNotConnectedError / ChessComNotConnectedError (from each
 * account's own api.ts) when that account isn't linked - callers catch
 * those by instanceof to pick the right status code. */
export async function fetchGamesForSource(
  source: GamesSource,
  timeClass: string,
  maxGames: number,
): Promise<{ pgn: string; username: string }> {
  if (source === "chesscom") {
    const username = await requireChessComUsername();
    const pgn = await fetchChessComPgn(username, { max: maxGames, perfType: timeClass, rated: true });
    return { pgn, username };
  }
  const link = await requireLichessLink();
  const pgn = await fetchUserPgn(link.token, link.username, timeClass, maxGames);
  return { pgn, username: link.username };
}

const CoachingSchema = z.object({
  what: z.string().describe("What happened, one sentence."),
  why: z.string().describe("Why it matters, one sentence."),
  missed: z.string().describe("What the player missed or does differently than stronger peers."),
  principle: z.string().describe("The general principle behind it."),
  drill: z.string().describe("One concrete next action or practice habit."),
});

const SYSTEM_PROMPT = `You are a chess coach writing the explanation for one
"focus area" in a player's profile - a pattern where players who share this
player's style, but are rated higher, consistently do something differently.
You're given the feature name and the player's value vs. that stronger
group's typical value. Write a short, concrete explanation in exactly this
shape: what happened -> why it matters -> what they missed (framed as "the
stronger players in your style group tend to...") -> the general principle
-> one specific action to train next. Each field is one plain sentence, no
jargon, no hedging, no restating the raw numbers verbatim.`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fillCoaching(focusAreas: any[], provider?: AiProvider, apiKey?: string, model?: string) {
  if (!provider || !apiKey) return focusAreas; // no client key supplied - leave coaching null
  const languageModel = resolveModel(provider, apiKey, model ?? "");
  if (!languageModel) return focusAreas;

  return Promise.all(
    focusAreas.map(async (area) => {
      try {
        const evidence = (area.evidence ?? [])
          .map((e: { feature: string; you: number; cohort: number }) => `${e.feature}: you ${e.you}, stronger-peers ${e.cohort}`)
          .join("; ");
        const { object } = await generateObject({
          model: languageModel,
          schema: CoachingSchema,
          system: SYSTEM_PROMPT,
          prompt: `Focus area: ${area.title}\nEvidence: ${evidence}\nEstimated rating value of closing this gap: ~${area.estimated_rating_gain}.`,
        });
        return { ...area, coaching: object };
      } catch {
        return area; // leave coaching null on any LLM failure - never fail the whole request
      }
    }),
  );
}

/** Upserts a completed profile the same way both the single-shot route
 * and the job-poll route need to - keyed by userId, gamesHash decides
 * whether a later request can skip re-analysis. */
export async function saveProfile(userId: string, profile: { source?: { games_analyzed?: number } }, gamesHash: string) {
  await prisma.playerProfile.upsert({
    where: { userId },
    create: {
      userId,
      data: profile,
      gamesHash,
      gamesCount: profile.source?.games_analyzed ?? 0,
    },
    update: {
      data: profile,
      gamesHash,
      gamesCount: profile.source?.games_analyzed ?? 0,
      computedAt: new Date(),
    },
  });
}
