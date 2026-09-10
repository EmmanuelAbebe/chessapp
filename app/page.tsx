import type { Metadata } from "next";
import { LandingPage } from "@/features/marketing/LandingPage";

export const metadata: Metadata = {
  title: "CoachMeChess — understand why you lost, not just where",
  description:
    "An AI chess coach that pairs Stockfish analysis with plain-language explanations of your mistakes, then finds the habits behind them. Play, import from Lichess, and see what to train next.",
};

export default function Home() {
  return <LandingPage />;
}
