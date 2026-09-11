import type { NextConfig } from "next";

// No COOP/COEP headers needed - Stockfish now runs as the lite
// single-threaded build (no SharedArrayBuffer), so nothing on this app
// requires cross-origin isolation. See stockfish-client.ts for why.
const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Default 1 MB is tight for a game-history push (moves/meta for a
      // whole chunk of games in one call) - features/history/
      // useGameHistory.ts already chunks those to ~20 games/call to stay
      // well under this regardless, but a few games with unusually long
      // move lists could still nudge past 1 MB. This is slack, not the
      // fix - the actual fix is chunking to begin with.
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
