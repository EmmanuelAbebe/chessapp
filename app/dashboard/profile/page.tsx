import type {} from "react/canary";
import { ViewTransition } from "react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import ProfileSection from "@/features/account/components/ProfileSection";
import ConnectedAccounts from "@/features/account/components/ConnectedAccounts";
import { GameDataCard } from "@/features/history/GameDataCard";

export default async function ProfilePage() {
  const session = await auth(); // non-null: DashboardLayout already redirected otherwise
  const [dbUser, lichessAccount] = await Promise.all([
    prisma.user.findUnique({ where: { id: session!.user.id } }),
    prisma.account.findFirst({
      where: { userId: session!.user.id, provider: "lichess" },
      select: { providerAccountId: true },
    }),
  ]);

  const memberSince = dbUser?.createdAt
    ? dbUser.createdAt.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      })
    : "—";

  return (
    <ViewTransition enter="nav-forward" exit="nav-forward" default="none">
      <div className="flex flex-col gap-6">
        <h1 className="text-xl font-bold text-text">Profile</h1>
        <ProfileSection
          initialProfile={{
            username: session!.user.name ?? session!.user.email ?? "Player",
            email: session!.user.email ?? "",
          }}
          memberSince={memberSince}
        />
        <ConnectedAccounts
          lichessUsername={lichessAccount?.providerAccountId ?? null}
        />

        <details className="rounded-lg border border-border-soft bg-surface">
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-text">
            Game data &amp; usernames
          </summary>
          <div className="border-t border-border-soft p-4">
            <GameDataCard />
          </div>
        </details>
      </div>
    </ViewTransition>
  );
}
