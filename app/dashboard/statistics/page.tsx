import type {} from "react/canary";
import { ViewTransition } from "react";
import { IBM_Plex_Sans, IBM_Plex_Sans_Condensed, IBM_Plex_Mono } from "next/font/google";
import { auth } from "@/auth";
import { getPlayerProfile } from "@/features/playermodel/data";
import { StatisticsPageClient } from "@/features/statistics/components/StatisticsPageClient";

// Scoped to this page only (not the root layout) - self-hosted via
// next/font so there's no runtime request/layout shift, exposed as CSS
// variables and applied only within the `.stats-typography` wrapper
// below (see globals.css) rather than swapping the app's fonts globally.
const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-sans",
  display: "swap",
});
const plexCondensed = IBM_Plex_Sans_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-plex-condensed",
  display: "swap",
});
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

export default async function StatisticsPage() {
  const session = await auth(); // non-null: DashboardLayout already redirected otherwise
  const profileRow = await getPlayerProfile(session!.user.id);

  return (
    <ViewTransition enter="nav-forward" exit="nav-forward" default="none">
      <div className={`stats-typography ${plexSans.variable} ${plexCondensed.variable} ${plexMono.variable}`}>
        <StatisticsPageClient initialProfile={profileRow?.data ?? null} />
      </div>
    </ViewTransition>
  );
}
