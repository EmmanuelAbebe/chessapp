"use client";

import { useState } from "react";
import SettingsCard from "../SettingsCard";
import SettingsItem from "../SettingsItem";
import SettingsToggle from "../SettingsToggle";
import { MdOutlinePublic } from "react-icons/md";

export default function AccountSection() {
  const [publicProfile, setPublicProfile] = useState(true);

  return (
    <SettingsCard title="Account">
      <SettingsItem
        item={{
          icon: <MdOutlinePublic />,
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
