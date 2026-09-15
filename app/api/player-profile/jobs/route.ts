import { createHash } from "node:crypto";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { LichessNotConnectedError, requireLichessLink } from "@/features/lichess/api";
import { fetchUserPgn, resolveMaxGames } from "@/features/playermodel/server/shared";
import { registerJob } from "@/features/playermodel/server/jobStore";
import type { AiProvider } from "@/features/settings/ai-provider-types";

export const dynamic = "force-dynamic";

type PostBody = {
  timeClass?: string;
  force?: boolean;
  maxGames?: number;
  provider?: AiProvider;
  apiKey?: string;
  model?: string;
};

/** Starts a chunked analysis and returns immediately - the client then
 * polls /api/player-profile/jobs/[id] for progress and, as batches
 * complete, real partial profiles it can already render. Use this
 * instead of the single-shot POST /api/player-profile for anything large
 * enough that showing progress matters. */
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

  const maxGames = await resolveMaxGames(userId, body.maxGames);

  let pgn: string;
  try {
    pgn = await fetchUserPgn(link.token, link.username, timeClass, maxGames);
  } catch (err) {
    return new Response(`Could not fetch games from Lichess: ${(err as Error).message}`, {
      status: 502,
    });
  }

  const gamesHash = createHash("sha1").update(pgn).digest("hex");

  // Same short-circuit as the single-shot route: nothing changed since
  // the last analysis, so there's no job to run at all.
  if (!body.force) {
    const existing = await prisma.playerProfile.findUnique({ where: { userId } });
    if (existing && existing.gamesHash === gamesHash) {
      return Response.json({ done: true, profile: existing.data });
    }
  }

  const serviceUrl = process.env.PLAYERMODEL_SERVICE_URL;
  if (!serviceUrl) {
    return new Response(
      "Player-model service not configured (PLAYERMODEL_SERVICE_URL missing)",
      { status: 503 },
    );
  }

  const serviceRes = await fetch(`${serviceUrl.replace(/\/$/, "")}/profile/jobs`, {
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
  const { job_id: jobId } = (await serviceRes.json()) as { job_id: string };

  registerJob(jobId, {
    userId, username: link.username, timeClass, gamesHash,
    provider: body.provider, apiKey: body.apiKey, model: body.model,
  });

  return Response.json({ done: false, jobId });
}
