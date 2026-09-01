"use client";

import SettingsCard from "../SettingsCard";
import SettingsItem from "../SettingsItem";
import SettingsToggle from "../SettingsToggle";
import { useSettings } from "../../SettingsContext";

export default function NotificationsSection() {
  const { settings, updateNotifications } = useSettings();

  return (
    <SettingsCard title="Notifications">
      <SettingsItem
        item={{
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
