"use server";

// DB-backed subscription state - was fully local (useState) in
// SubscriptionSection.tsx before, resetting on every reload. No payment
// processor is wired up yet, so this just persists which plan/status the
// user picked; the invoice list and card on that section stay decorative.

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export type SubscriptionPlan = "Free" | "Premium" | "Pro";
export type SubscriptionStatus = "Active" | "Canceled";

export type SubscriptionPayload = {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
};

const DEFAULT_SUBSCRIPTION: SubscriptionPayload = { plan: "Premium", status: "Active" };

function toPayload(row: { plan: string; status: string } | null): SubscriptionPayload {
  if (!row) return DEFAULT_SUBSCRIPTION;
  return {
    plan: (row.plan.charAt(0).toUpperCase() + row.plan.slice(1)) as SubscriptionPlan,
    status: row.status === "canceled" ? "Canceled" : "Active",
  };
}

/** Falls back to the same "Premium / Active" default the section used to
 * hard-code, so a signed-in user with no row yet (or a signed-out visitor)
 * sees identical behaviour to before this was persisted. */
export async function getSubscriptionServer(): Promise<SubscriptionPayload> {
  const userId = (await auth())?.user?.id;
  if (!userId) return DEFAULT_SUBSCRIPTION;
  const row = await prisma.subscription.findUnique({ where: { userId } });
  return toPayload(row);
}

export async function setSubscriptionPlanServer(plan: SubscriptionPlan): Promise<void> {
  const userId = (await auth())?.user?.id;
  if (!userId) return;
  await prisma.subscription.upsert({
    where: { userId },
    create: { userId, plan: plan.toLowerCase() },
    update: { plan: plan.toLowerCase() },
  });
  revalidatePath("/dashboard/subscription");
}

export async function setSubscriptionStatusServer(status: SubscriptionStatus): Promise<void> {
  const userId = (await auth())?.user?.id;
  if (!userId) return;
  await prisma.subscription.upsert({
    where: { userId },
    create: { userId, status: status.toLowerCase() },
    update: { status: status.toLowerCase() },
  });
  revalidatePath("/dashboard/subscription");
}
