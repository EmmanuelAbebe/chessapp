"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { getUserSettingsServer, saveUserSettingsServer } from "./serverActions";

// Same separate-key convention as useAiProviderConfig.ts - this isn't
// part of the generic (unpersisted) AppSettings blob either.
const STORAGE_KEY = "chessapp:player-identity";

function readStoredUsernames(): string {
  if (typeof window === "undefined") return "";

  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

/** A comma-separated list of the player's own usernames across chess
 * sites (lichess, chess.com, ...) - matched against a PGN's White/Black
 * headers on import so a game can be attributed to "you" instead of the
 * opponent without asking on every single import. Free text, not a
 * fixed list, same reasoning as the AI provider's model field: names
 * change and vary per site more often than this code would.
 *
 * Signed-in users additionally sync this with the DB (features/settings/
 * serverActions.ts), same one-pull-then-push pattern as
 * useAiProviderConfig. */
export function usePlayerIdentity() {
  const { status } = useSession();
  const [usernames, setUsernamesState] = useState("");
  const syncedRef = useRef(false);

  useEffect(() => {
    setUsernamesState(readStoredUsernames());
  }, []);

  useEffect(() => {
    if (status !== "authenticated" || syncedRef.current) return;
    syncedRef.current = true;
    void (async () => {
      const remote = await getUserSettingsServer();
      if (remote?.usernames) {
        setUsernamesState(remote.usernames);
        try {
          window.localStorage.setItem(STORAGE_KEY, remote.usernames);
        } catch {
          // ignore - see setUsernames's own comment
        }
      } else {
        setUsernamesState((current) => {
          if (current) void saveUserSettingsServer({ usernames: current });
          return current;
        });
      }
    })();
  }, [status]);

  function setUsernames(next: string) {
    setUsernamesState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage can fail (private browsing, quota) - the in-memory
      // state still updates for this session either way.
    }
    if (status === "authenticated") void saveUserSettingsServer({ usernames: next });
  }

  const usernameList = usernames
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);

  return { usernames, setUsernames, usernameList };
}
