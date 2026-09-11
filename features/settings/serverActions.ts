"use server";

// DB-backed mirror of SettingsContext / useAiProviderConfig / usePlayerIdentity's
// localStorage stores, for signed-in users. The API key is deliberately never
// part of this - AiCoachSection's own copy promises it's "stored only in your
// browser, sent only to the provider you pick" - so only {provider, model} sync
// here; the key stays localStorage-only exactly as before. No-ops when signed out.

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { AiProvider } from "./ai-provider-types";
import type { AppSettings } from "./types";

export type SyncedAiProvider = { provider: AiProvider; model: string };

export type UserSettingsPayload = {
  settings: AppSettings | null;
  aiProvider: SyncedAiProvider | null;
  usernames: string;
};

export async function getUserSettingsServer(): Promise<UserSettingsPayload | null> {
  const userId = (await auth())?.user?.id;
  if (!userId) return null;
  const row = await prisma.userSettings.findUnique({ where: { userId } });
  if (!row) return null;
  return {
    settings: row.settings as AppSettings,
    aiProvider: row.aiProvider as SyncedAiProvider,
    usernames: row.usernames ?? "",
  };
}

/** Whole-object upsert, same "always write the full current object" shape
 * the localStorage hooks already use - callers pass whichever of the three
 * fields changed; the others keep their last-synced value. */
export async function saveUserSettingsServer(patch: {
  settings?: AppSettings;
  aiProvider?: SyncedAiProvider;
  usernames?: string;
}): Promise<void> {
  const userId = (await auth())?.user?.id;
  if (!userId) return;

  await prisma.userSettings.upsert({
    where: { userId },
    create: {
      userId,
      settings: patch.settings ?? {},
      aiProvider: patch.aiProvider ?? {},
      usernames: patch.usernames,
    },
    update: {
      ...(patch.settings !== undefined && { settings: patch.settings }),
      ...(patch.aiProvider !== undefined && { aiProvider: patch.aiProvider }),
      ...(patch.usernames !== undefined && { usernames: patch.usernames }),
    },
  });
}
