"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

/** The compact `coach_context` string from the player's stored profile
 * (features/playermodel), if they have one - fed into /api/coach so the
 * board's live commentary can reference recurring patterns instead of
 * only ever reacting to the one move on screen. `null` when signed out,
 * not yet analyzed, or the fetch fails - /api/coach treats that exactly
 * like today (no player context at all). */
export function usePlayerCoachContext(): string | null {
  const { status } = useSession();
  const [context, setContext] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;
    fetch("/api/player-profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled) setContext(d?.coach_context ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [status]);

  return context;
}
