"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { DEFAULT_SETTINGS } from "./defaults";
import type { AppSettings, NotificationSettings, SoundSettings } from "./types";

type SettingsContextValue = {
  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => void;
  updateSound: (patch: Partial<SoundSettings>) => void;
  updateNotifications: (patch: Partial<NotificationSettings>) => void;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    document.documentElement.dataset.themeShade = settings.themeShade;
  }, [settings.themeShade]);

  function updateSettings(patch: Partial<AppSettings>) {
    setSettings((prev) => ({ ...prev, ...patch }));
  }

  function updateSound(patch: Partial<SoundSettings>) {
    setSettings((prev) => ({ ...prev, sound: { ...prev.sound, ...patch } }));
  }

  function updateNotifications(patch: Partial<NotificationSettings>) {
    setSettings((prev) => ({
      ...prev,
      notifications: { ...prev.notifications, ...patch },
    }));
  }

  return (
    <SettingsContext.Provider
      value={{ settings, updateSettings, updateSound, updateNotifications }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return ctx;
}
