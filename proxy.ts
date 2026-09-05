import NextAuth from "next-auth";
import authConfig from "@/auth.config";

// A second, lightweight NextAuth instance just for Proxy - no adapter, no
// Credentials provider, no Prisma import in this bundle.
const { auth } = NextAuth(authConfig);

export function proxy(...args: Parameters<typeof auth>) {
  return auth(...args);
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
