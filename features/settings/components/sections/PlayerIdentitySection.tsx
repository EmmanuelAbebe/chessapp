"use client";

import SettingsCard from "../SettingsCard";
import { usePlayerIdentity } from "../../usePlayerIdentity";
import { FaUserCheck } from "react-icons/fa6";

export default function PlayerIdentitySection() {
  const { usernames, setUsernames } = usePlayerIdentity();

  return (
    <SettingsCard title="Player Identity">
      <div className="flex flex-col gap-1.5 py-3">
        <label
          htmlFor="player-usernames"
          className="flex items-center gap-2 text-sm font-semibold text-text"
        >
          <FaUserCheck className="text-text-dim" />
          Your usernames
        </label>
        <input
          id="player-usernames"
          type="text"
          value={usernames}
          onChange={(e) => setUsernames(e.target.value)}
          placeholder="e.g. jonkimura33, MyChessComHandle"
          autoComplete="off"
          className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 font-mono text-xs text-text placeholder:text-text-faint focus:border-accent focus:outline-none"
        />
        <p className="text-xs text-text-faint">
          Comma-separated. Matched against a PGN&apos;s White/Black names on
          import so a game counts as yours on the Statistics page instead
          of the opponent&apos;s - stored only in your browser.
        </p>
      </div>
    </SettingsCard>
  );
}
