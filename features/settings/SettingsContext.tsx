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
  // React may invoke a setState updater function more than once for the
  // same conceptual update (Strict Mode, concurrent retries) and calling a
  // Server Action from inside one - as this used to do - trips "Cannot
  // update a component while rendering a different component" the moment
  // that action's own state changes land mid-render. Everything below
  // reads the latest settings from this ref instead, and only ever calls
  // setSettings / the server action as separate, top-level statements.
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  useEffect(() => {
    document.documentElement.dataset.themeShade = settings.themeShade;
  }, [settings.themeShade]);

  useEffect(() => {
    if (status !== "authenticated" || syncedRef.current) return;
    syncedRef.current = true;
    void (async () => {
      const remote = await getUserSettingsServer();
      if (remote?.settings) {
        const next = { ...settingsRef.current, ...remote.settings };
        setSettings(next);
      } else {
        void saveUserSettingsServer({ settings: settingsRef.current });
      }
    })();
  }, [status]);

  function persist(next: AppSettings) {
    if (status === "authenticated") void saveUserSettingsServer({ settings: next });
  }

  function updateSettings(patch: Partial<AppSettings>) {
    const next = { ...settingsRef.current, ...patch };
    setSettings(next);
    persist(next);
  }

  function updateSound(patch: Partial<SoundSettings>) {
    const next = { ...settingsRef.current, sound: { ...settingsRef.current.sound, ...patch } };
    setSettings(next);
    persist(next);
  }

  function updateNotifications(patch: Partial<NotificationSettings>) {
    const next = {
      ...settingsRef.current,
      notifications: { ...settingsRef.current.notifications, ...patch },
    };
    setSettings(next);
    persist(next);
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
