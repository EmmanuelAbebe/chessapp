import { createHash } from "node:crypto";
import { generateObject } from "ai";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { resolveModel } from "@/lib/ai/resolveModel";
import { LichessNotConnectedError, requireLichessLink } from "@/features/lichess/api";
import type { AiProvider } from "@/features/settings/ai-provider-types";

export const dynamic = "force-dynamic";

// Lichess caps a single export at this many games; also a sane upper bound
// so a client-supplied maxGames can't request an enormous PGN.
const MAX_GAMES_CEILING = 300;
const MAX_GAMES_FLOOR = 10;
const MAX_GAMES_FALLBACK = 60; // used only when the user has no imported history to size from

type PostBody = {
  timeClass?: string;
  force?: boolean;
  /** How many games to fetch/analyze. Omit to default to the size of the
   * user's own imported game history (features/history) - if they imported
   * 100 games, the profile analyzes ~100 too, instead of a fixed number
   * unrelated to what they actually brought in. */
  maxGames?: number;
  // Same BYO-key pattern as /api/coach - used only in-memory, for this one
  // request, to phrase each focus area's coaching text. Never persisted;
  // the stored PlayerProfile.data keeps whatever coaching text (or null)
  // resulted, same as any other field.
  provider?: AiProvider;
  apiKey?: string;
  model?: string;
};

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

async function fetchUserPgn(
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fillCoaching(focusAreas: any[], provider?: AiProvider, apiKey?: string, model?: string) {
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

export async function GET() {
  const userId = (await auth())?.user?.id;
  if (!userId) return new Response("Not signed in", { status: 401 });

  const row = await prisma.playerProfile.findUnique({ where: { userId } });
  if (!row) return new Response("No profile yet", { status: 404 });
  return Response.json(row.data);
}

export async function POST(request: Request) {
  const userId = (await auth())?.user?.id;
  if (!userId) return new Response("Not signed in", { status: 401 });

  let body: PostBody;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const timeClass = body.timeClass ?? "blitz";

  let link;
  try {
    link = await requireLichessLink();
  } catch (err) {
    if (err instanceof LichessNotConnectedError) {
      return new Response(err.message, { status: 400 });
    }
    throw err;
  }

  let maxGames: number;
  if (typeof body.maxGames === "number" && Number.isFinite(body.maxGames)) {
    maxGames = body.maxGames;
  } else {
    const importedCount = await prisma.gameRecord.count({ where: { userId } });
    maxGames = importedCount || MAX_GAMES_FALLBACK;
  }
  maxGames = Math.round(Math.min(MAX_GAMES_CEILING, Math.max(MAX_GAMES_FLOOR, maxGames)));

  let pgn: string;
  try {
    pgn = await fetchUserPgn(link.token, link.username, timeClass, maxGames);
  } catch (err) {
    return new Response(`Could not fetch games from Lichess: ${(err as Error).message}`, {
      status: 502,
    });
  }

  const gamesHash = createHash("sha1").update(pgn).digest("hex");

  const existing = await prisma.playerProfile.findUnique({ where: { userId } });
  if (existing && existing.gamesHash === gamesHash && !body.force) {
    return Response.json(existing.data);
  }

  const serviceUrl = process.env.PLAYERMODEL_SERVICE_URL;
  if (!serviceUrl) {
    return new Response(
      "Player-model service not configured (PLAYERMODEL_SERVICE_URL missing)",
      { status: 503 },
    );
  }

  const serviceRes = await fetch(`${serviceUrl.replace(/\/$/, "")}/profile`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.PLAYERMODEL_SERVICE_TOKEN
        ? { "X-Service-Token": process.env.PLAYERMODEL_SERVICE_TOKEN }
        : {}),
    },
    body: JSON.stringify({ games_pgn: pgn, username: link.username, time_class: timeClass }),
  });

  if (!serviceRes.ok) {
    const detail = await serviceRes.text().catch(() => "");
    return new Response(detail || "Player-model service error", { status: serviceRes.status });
  }

  const profile = await serviceRes.json();
  profile.focus_areas = await fillCoaching(
    profile.focus_areas ?? [],
    body.provider,
    body.apiKey,
    body.model,
  );

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

  return Response.json(profile);
}
