import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import Lichess from "@/features/auth/lichess";

// Edge-safe half of the auth config: no Prisma adapter, no Credentials
// provider (its authorize() needs Prisma, which isn't Edge-safe) - this
// is the part proxy.ts can import directly. auth.ts spreads this
// and adds the rest for everywhere else (Node runtime). Lichess is a
// public OAuth client (PKCE, no secret) - its config is edge-safe too;
// the userinfo fetch only runs in the Node callback route.
export default {
  providers: [Google, Lichess()],
  pages: { signIn: "/login" },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isDashboard = nextUrl.pathname.startsWith("/dashboard");
      return isDashboard ? isLoggedIn : true;
    },
  },
} satisfies NextAuthConfig;
