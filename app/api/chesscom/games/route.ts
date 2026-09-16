import { ChessComNotConnectedError, fetchChessComPgn, requireChessComUsername } from "@/features/chesscom/api";

export const dynamic = "force-dynamic";

/** Concatenated PGN text, same content-type/shape as /api/lichess/games so
 * the client's importer doesn't care which source it came from. */
export async function GET(request: Request) {
  let username: string;
  try {
    username = await requireChessComUsername();
  } catch (err) {
    if (err instanceof ChessComNotConnectedError) {
      return new Response(err.message, { status: 401 });
    }
    throw err;
  }

  const params = new URL(request.url).searchParams;
  const max = Number(params.get("max") ?? "100") || 100;
  const perfType = params.get("perfType") ?? undefined;
  const ratedParam = params.get("rated");

  let pgn: string;
  try {
    pgn = await fetchChessComPgn(username, {
      max,
      perfType,
      rated: ratedParam === null ? undefined : ratedParam === "true",
    });
  } catch (err) {
    return new Response((err as Error).message || "chess.com fetch failed", { status: 502 });
  }

  return new Response(pgn, {
    headers: {
      "Content-Type": "application/x-chess-pgn; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
