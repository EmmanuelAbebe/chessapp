"use client";

import SettingsCard from "../SettingsCard";
import SettingsItem from "../SettingsItem";
import SettingsToggle from "../SettingsToggle";
import { useSettings } from "../../SettingsContext";
import { TbReportAnalytics } from "react-icons/tb";
import { MdBubbleChart } from "react-icons/md";
import { FiBell, FiVolume2 } from "react-icons/fi";
import { IoMdSwap } from "react-icons/io";

export default function NotificationsSection() {
  const { settings, updateNotifications } = useSettings();

  return (
    <SettingsCard title="Notifications">
      <SettingsItem
        item={{
          icon: <FiBell />,
          title: "Notifications",
          content: (
            <SettingsToggle
              setting={{
                label: "Notifications",
                isSelected: settings.notifications.enabled,
                onChange: (enabled) => updateNotifications({ enabled }),
              }}
            />
          ),
        }}
      />

      <SettingsItem
        item={{
          icon: <IoMdSwap />,
          title: "Your Turn",
          content: (
            <SettingsToggle
              setting={{
                label: "Your Turn",
                isSelected: settings.notifications.yourTurn,
                onChange: (yourTurn) => updateNotifications({ yourTurn }),
              }}
            />
          ),
        }}
      />

      <SettingsItem
        item={{
          icon: <TbReportAnalytics />,
          title: "Game Result",
          content: (
            <SettingsToggle
              setting={{
                label: "Game Result",
                isSelected: settings.notifications.gameResult,
                onChange: (gameResult) => updateNotifications({ gameResult }),
              }}
            />
          ),
        }}
      />

      <SettingsItem
        item={{
          icon: <MdBubbleChart />,
          title: "Coaching Insights",
          content: (
            <SettingsToggle
              setting={{
                label: "Coaching Insights",
                isSelected: settings.notifications.coachingInsights,
                onChange: (coachingInsights) =>
                  updateNotifications({ coachingInsights }),
              }}
            />
          ),
        }}
      />

      <SettingsItem
        item={{
          icon: <FiVolume2 />,
          title: "Notification Sound",
          content: (
            <SettingsToggle
              setting={{
                label: "Notification Sound",
                isSelected: settings.notifications.sound,
                onChange: (sound) => updateNotifications({ sound }),
              }}
            />
          ),
        }}
      />
    </SettingsCard>
  );
}
