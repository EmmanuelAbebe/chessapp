import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { fetchChessComProfile, getChessComUsername } from "@/features/chesscom/api";

// Mirrors /api/lichess/account's shape - the board-import modal (and
// anything else deciding whether to offer a one-click import) pings this
// the same way for either provider.
export async function GET() {
  const userId = (await auth())?.user?.id;
  if (!userId) return NextResponse.json({ error: "not_signed_in" }, { status: 401 });

  const username = await getChessComUsername(userId);
  if (!username) return NextResponse.json({ error: "not_connected" }, { status: 401 });

  const profile = await fetchChessComProfile(username);
  if (!profile) {
    return NextResponse.json({ error: "chesscom_error" }, { status: 502 });
  }
  return NextResponse.json(profile);
}
