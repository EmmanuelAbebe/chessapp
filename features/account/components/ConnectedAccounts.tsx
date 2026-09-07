"use client";

import { useState, useTransition } from "react";
import { signIn } from "next-auth/react";
import { SiLichess } from "react-icons/si";
import { secondaryButtonClass } from "@/features/account/lib/styles";
import { disconnectLichess } from "@/features/lichess/actions";

export default function ConnectedAccounts({
  lichessUsername,
}: {
  lichessUsername: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [connecting, setConnecting] = useState(false);

  return (
    <section>
      <h2 className="text-lg font-semibold text-text">Connected accounts</h2>
      <p className="mt-1 text-sm text-text-faint">
        Link Lichess to import your games in one click and let the coach read
        your Lichess studies and puzzle history.
      </p>

      <div className="mt-4 flex items-center gap-3 rounded-lg border border-border bg-surface-raised p-4">
        <SiLichess aria-hidden="true" className="h-6 w-6 shrink-0 text-text" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-text">Lichess</p>
          <p className="truncate text-xs text-text-faint">
            {lichessUsername ? `Connected as ${lichessUsername}` : "Not connected"}
          </p>
        </div>

        {lichessUsername ? (
          <button
            type="button"
            disabled={isPending}
            onClick={() => startTransition(() => disconnectLichess())}
            className={secondaryButtonClass}
          >
            {isPending ? "Disconnecting…" : "Disconnect"}
          </button>
        ) : (
          <button
            type="button"
            disabled={connecting}
            onClick={() => {
              setConnecting(true);
              signIn("lichess", { callbackUrl: "/dashboard/profile" });
            }}
            className={secondaryButtonClass}
          >
            {connecting ? "Redirecting…" : "Connect"}
          </button>
        )}
      </div>
    </section>
  );
}
