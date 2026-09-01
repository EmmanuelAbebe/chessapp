"use client";

import SettingsCard from "../SettingsCard";
import SettingsItem from "../SettingsItem";
import SettingsVolume from "../SettingsVolume";
import { useSettings } from "../../SettingsContext";

export default function SoundSection() {
  const { settings, updateSound } = useSettings();

  return (
    <SettingsCard title="Sound">
      <SettingsItem
        item={{
          title: "Master Volume",
          content: (
            <SettingsVolume
              setting={{
                label: "Master Volume",
                value: settings.sound.master,
                onChange: (master) => updateSound({ master }),
              }}
            />
          ),
        }}
      />

      <SettingsItem
        item={{
          title: "Piece Movement",
          content: (
            <SettingsVolume
              setting={{
                label: "Piece Movement",
                value: settings.sound.pieceMove,
                onChange: (pieceMove) => updateSound({ pieceMove }),
              }}
            />
          ),
        }}
      />

      <SettingsItem
        item={{
          title: "Capture",
          content: (
            <SettingsVolume
              setting={{
                label: "Capture",
                value: settings.sound.capture,
                onChange: (capture) => updateSound({ capture }),
              }}
            />
          ),
        }}
      />

      <SettingsItem
        item={{
          title: "Check",
          content: (
            <SettingsVolume
              setting={{
                label: "Check",
                value: settings.sound.check,
                onChange: (check) => updateSound({ check }),
              }}
            />
          ),
        }}
      />

      <SettingsItem
        item={{
          title: "AI Voice",
          content: (
            <SettingsVolume
              setting={{
                label: "AI Voice",
                value: settings.sound.aiVoice,
                onChange: (aiVoice) => updateSound({ aiVoice }),
              }}
            />
          ),
        }}
      />
    </SettingsCard>
  );
}
