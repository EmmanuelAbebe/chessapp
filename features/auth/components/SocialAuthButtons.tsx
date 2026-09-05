"use client";

import { signIn } from "next-auth/react";
import { SOCIAL_PROVIDERS } from "../data";

// Only Google is wired to next-auth right now, and sign-in is Google-only
// for now by product decision - the other entries in SOCIAL_PROVIDERS stay
// in the data file (no providerId) for a future pass, but aren't rendered
// as dead/preview buttons here.
const ACTIVE_PROVIDERS = SOCIAL_PROVIDERS.filter((p) => p.providerId);

export default function SocialAuthButtons() {
  return (
    <div className="flex flex-col gap-3">
      {ACTIVE_PROVIDERS.map(({ name, Icon, className, providerId }) => (
        <button
          key={name}
          type="button"
          onClick={() => signIn(providerId, { callbackUrl: "/dashboard" })}
          className={`flex w-full items-center justify-center gap-3 rounded-lg px-5 py-2.5 text-sm font-medium transition ${className}`}
        >
          <Icon aria-hidden="true" className="h-4 w-4" />
          Continue with {name}
        </button>
      ))}
    </div>
  );
}
