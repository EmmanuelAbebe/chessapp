import type { NextConfig } from "next";

// No COOP/COEP headers needed - Stockfish now runs as the lite
// single-threaded build (no SharedArrayBuffer), so nothing on this app
// requires cross-origin isolation. See stockfish-client.ts for why.
const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
