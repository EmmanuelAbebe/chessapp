"use client";

import { useState } from "react";
import SettingsCard from "../SettingsCard";
import SettingsItem from "../SettingsItem";
import SettingsToggle from "../SettingsToggle";

export default function AccountSection() {
  const [publicProfile, setPublicProfile] = useState(true);

  return (
    <SettingsCard title="Account">
      <SettingsItem
        item={{
          title: "Public profile",
          content: (
            <SettingsToggle
              setting={{
                label: "Public profile",
                isSelected: publicProfile,
                onChange: setPublicProfile,
              }}
            />
          ),
        }}
      />
    </SettingsCard>
  );
}
