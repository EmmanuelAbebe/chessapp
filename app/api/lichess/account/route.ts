import { NextResponse } from "next/server";
import { lichessFetch, LichessNotConnectedError } from "@/features/lichess/api";

// Example of using the stored Lichess OAuth token: returns the signed-in
// user's Lichess account. The board-import modal also pings this to decide
// whether to offer the one-click "import my games" button.
export async function GET() {
  try {
    const res = await lichessFetch("/api/account");
    if (!res.ok) {
      return NextResponse.json(
        { error: "lichess_error", status: res.status },
        { status: 502 },
      );
    }
    const account = await res.json();
    return NextResponse.json({
      id: account.id,
      username: account.username,
      title: account.title ?? null,
      url: account.url ?? `https://lichess.org/@/${account.username}`,
      perfs: account.perfs ?? null,
    });
  } catch (err) {
    if (err instanceof LichessNotConnectedError) {
      return NextResponse.json({ error: "not_connected" }, { status: 401 });
    }
    throw err;
  }
}
