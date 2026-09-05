"use client";

import { signIn } from "next-auth/react";
import { SOCIAL_PROVIDERS } from "../data";

export default function SocialAuthButtons() {
  return (
    <div className="flex flex-col gap-3">
      {SOCIAL_PROVIDERS.map(({ name, Icon, className, providerId }) => (
        <button
          key={name}
          type="button"
          onClick={
            providerId
              ? () => signIn(providerId, { callbackUrl: "/dashboard" })
              : undefined
          }
          disabled={!providerId}
          className={`flex w-full items-center justify-center gap-3 rounded-lg px-5 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
        >
          <Icon aria-hidden="true" className="h-4 w-4" />
          Continue with {name}
        </button>
      ))}
      <p className="text-center text-xs text-text-faint">
        Only Google is connected right now — the rest are preview only
      </p>
    </div>
  );
}
