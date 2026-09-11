"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useSession } from "next-auth/react";
import { DEFAULT_SETTINGS } from "./defaults";
import { getUserSettingsServer, saveUserSettingsServer } from "./serverActions";
import type { AppSettings, NotificationSettings, SoundSettings } from "./types";

type SettingsContextValue = {
  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => void;
  updateSound: (patch: Partial<SoundSettings>) => void;
  updateNotifications: (patch: Partial<NotificationSettings>) => void;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

// Signed-out: exactly as before - plain in-memory state, resets on
// reload. Signed-in: also synced with the DB (features/settings/
// serverActions.ts) - pulled once per sign-in (merged over the defaults),
// pushed on every change - so board/appearance/engine/sound/notification
// preferences follow the account instead of resetting per browser.
export function SettingsProvider({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const syncedRef = useRef(false);

  useEffect(() => {
    document.documentElement.dataset.themeShade = settings.themeShade;
  }, [settings.themeShade]);

  useEffect(() => {
    if (status !== "authenticated" || syncedRef.current) return;
    syncedRef.current = true;
    void (async () => {
      const remote = await getUserSettingsServer();
      if (remote?.settings) {
        setSettings((prev) => ({ ...prev, ...remote.settings }));
      } else {
        setSettings((prev) => {
          void saveUserSettingsServer({ settings: prev });
          return prev;
        });
      }
    })();
  }, [status]);

  function persist(next: AppSettings) {
    if (status === "authenticated") void saveUserSettingsServer({ settings: next });
  }

  function updateSettings(patch: Partial<AppSettings>) {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      persist(next);
      return next;
    });
  }

  function updateSound(patch: Partial<SoundSettings>) {
    setSettings((prev) => {
      const next = { ...prev, sound: { ...prev.sound, ...patch } };
      persist(next);
      return next;
    });
  }

  function updateNotifications(patch: Partial<NotificationSettings>) {
    setSettings((prev) => {
      const next = { ...prev, notifications: { ...prev.notifications, ...patch } };
      persist(next);
      return next;
    });
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
