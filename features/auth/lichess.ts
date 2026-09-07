import type { OAuth2Config } from "next-auth/providers";

type TokenSet = { access_token?: string; [key: string]: unknown };

// Custom Auth.js provider for Lichess. Lichess is a *public* OAuth client:
// the Authorization Code + PKCE flow with NO client secret. `client_id` can
// be any stable string that identifies this app - Lichess doesn't require
// registering an app for the PKCE flow (registration only buys you a
// client secret and higher rate limits), so we default it to a constant
// and let AUTH_LICHESS_ID override it per environment.
//
// Docs: https://lichess.org/api#tag/OAuth
//
// Redirect URI to whitelist (there's nothing to whitelist for unregistered
// PKCE clients, but keep it handy if an app is ever registered):
//   dev:  http://localhost:3000/api/auth/callback/lichess
//   prod: https://<domain>/api/auth/callback/lichess

// Scopes requested on the consent screen. Public data (profile, game
// exports) needs no scope at all; these only add what's gated:
//   email:read      - the account's email (used to show it, NOT to auto-link)
//   preference:read - client preferences
//   study:read      - the user's studies
//   puzzle:read     - the user's puzzle activity
export const LICHESS_SCOPES = [
  "email:read",
  "preference:read",
  "study:read",
  "puzzle:read",
] as const;

export interface LichessProfile {
  id: string;
  username: string;
  email?: string;
  title?: string;
  url?: string;
  profile?: {
    firstName?: string;
    lastName?: string;
    bio?: string;
  };
  [key: string]: unknown;
}

export default function Lichess(): OAuth2Config<LichessProfile> {
  return {
    id: "lichess",
    name: "Lichess",
    type: "oauth",
    checks: ["pkce", "state"],
    clientId: process.env.AUTH_LICHESS_ID || "chessapp-coach",
    // Public client - no secret is sent to the token endpoint.
    client: { token_endpoint_auth_method: "none" },
    authorization: {
      url: "https://lichess.org/oauth",
      params: { scope: LICHESS_SCOPES.join(" ") },
    },
    token: "https://lichess.org/api/token",
    userinfo: {
      // Lichess has no OIDC userinfo endpoint. /api/account is the profile;
      // email lives on a separate endpoint and is only returned when the
      // email:read scope was granted, so fetch both and merge.
      url: "https://lichess.org/api/account",
      async request({ tokens }: { tokens: TokenSet }) {
        const headers = { Authorization: `Bearer ${tokens.access_token}` };
        const account: LichessProfile = await fetch(
          "https://lichess.org/api/account",
          { headers },
        ).then((r) => r.json());

        let email: string | undefined;
        try {
          const res = await fetch("https://lichess.org/api/account/email", {
            headers,
          });
          if (res.ok) email = (await res.json())?.email || undefined;
        } catch {
          // email:read not granted or Lichess has no email on file - fine
        }
        return { ...account, email };
      },
    },
    profile(profile) {
      const fullName = [profile.profile?.firstName, profile.profile?.lastName]
        .filter(Boolean)
        .join(" ");
      return {
        id: profile.id,
        name: fullName || profile.username,
        email: profile.email ?? null,
        image: null,
      };
    },
    style: { text: "#fff", bg: "#000" },
  };
}
