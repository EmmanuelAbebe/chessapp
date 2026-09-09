"use client";

import SettingsCard from "../SettingsCard";
import { GameDataCard } from "@/features/history/GameDataCard";

export default function GameDataSection() {
  return (
    <SettingsCard title="Player Identity & Games">
      <div className="py-2">
        <GameDataCard />
      </div>
    </SettingsCard>
  );
}
