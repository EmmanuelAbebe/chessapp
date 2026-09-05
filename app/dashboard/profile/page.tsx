import type {} from "react/canary";
import { ViewTransition } from "react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import ProfileSection from "@/features/account/components/ProfileSection";

export default async function ProfilePage() {
  const session = await auth(); // non-null: DashboardLayout already redirected otherwise
  const dbUser = await prisma.user.findUnique({
    where: { id: session!.user.id },
  });

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
      </div>
    </ViewTransition>
  );
}
