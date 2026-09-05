import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

// Edge-safe half of the auth config: no Prisma adapter, no Credentials
// provider (its authorize() needs Prisma, which isn't Edge-safe) - this
// is the part middleware.ts can import directly. auth.ts spreads this
// and adds the rest for everywhere else (Node runtime).
export default {
  providers: [Google],
  pages: { signIn: "/login" },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isDashboard = nextUrl.pathname.startsWith("/dashboard");
      return isDashboard ? isLoggedIn : true;
    },
  },
} satisfies NextAuthConfig;
