import { requireLichessLink, LichessNotConnectedError } from "@/features/lichess/api";

export const dynamic = "force-dynamic";

// Streams the signed-in user's own game archive (PGN) straight from
// Lichess to the browser. The OAuth token is applied server-side so it
// never reaches the client; the response body is piped through
// unbuffered, so the client's incremental importer sees games arrive the
// same way it does from a public lichess.org export URL.
export async function GET(request: Request) {
  let link;
  try {
    link = await requireLichessLink();
  } catch (err) {
    if (err instanceof LichessNotConnectedError) {
      return new Response(err.message, { status: 401 });
    }
    throw err;
  }

  const params = new URL(request.url).searchParams;
  const upstream = new URL(
    `https://lichess.org/api/games/user/${encodeURIComponent(link.username)}`,
  );
  // Keep the PGN lean - just what the tree/stats importer reads.
  upstream.searchParams.set("max", params.get("max") ?? "100");
  upstream.searchParams.set("clocks", "false");
  upstream.searchParams.set("evals", "false");
  upstream.searchParams.set("opening", "true");
  const since = params.get("since");
  if (since) upstream.searchParams.set("since", since);
  const rated = params.get("rated");
  if (rated) upstream.searchParams.set("rated", rated);

  const res = await fetch(upstream, {
    headers: {
      Authorization: `Bearer ${link.token}`,
      Accept: "application/x-chess-pgn",
    },
  });

  if (!res.ok || !res.body) {
    return new Response(`Lichess export failed: ${res.status}`, { status: 502 });
  }

  return new Response(res.body, {
    headers: {
      "Content-Type": "application/x-chess-pgn; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
