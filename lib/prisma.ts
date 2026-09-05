import { PrismaClient } from "@prisma/client";

// Next.js dev hot-reload re-executes this module on every edit; caching
// the client on `globalThis` avoids spawning a fresh client (and DB
// connection pool) each time instead of reusing one across reloads.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
