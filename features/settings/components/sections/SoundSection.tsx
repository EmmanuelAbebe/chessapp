"use client";

import SettingsCard from "../SettingsCard";
import SettingsItem from "../SettingsItem";
import SettingsVolume from "../SettingsVolume";
import { useSettings } from "../../SettingsContext";
import { FaVolumeUp } from "react-icons/fa";
import {
  FaChessPawn,
  FaChessRook,
  FaChessKing,
  FaBrain,
} from "react-icons/fa6";

export default function SoundSection() {
  const { settings, updateSound } = useSettings();

  return (
    <SettingsCard title="Sound">
      <SettingsItem
        item={{
          icon: <FaVolumeUp />,
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
          icon: <FaChessPawn />,
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
          icon: <FaChessRook />,
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
          icon: <FaChessKing />,
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
          icon: <FaBrain />,
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
