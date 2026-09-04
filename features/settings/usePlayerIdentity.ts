"use client";

import { useEffect, useState } from "react";

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
 * change and vary per site more often than this code would. */
export function usePlayerIdentity() {
  const [usernames, setUsernamesState] = useState("");

  useEffect(() => {
    setUsernamesState(readStoredUsernames());
  }, []);

  function setUsernames(next: string) {
    setUsernamesState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage can fail (private browsing, quota) - the in-memory
      // state still updates for this session either way.
    }
  }

  const usernameList = usernames
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);

  return { usernames, setUsernames, usernameList };
}
