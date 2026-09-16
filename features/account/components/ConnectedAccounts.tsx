"use client";

import { useState, useTransition } from "react";
import { signIn } from "next-auth/react";
import { SiLichess, SiChessdotcom } from "react-icons/si";
import { secondaryButtonClass } from "@/features/account/lib/styles";
import { disconnectLichess } from "@/features/lichess/actions";
import { connectChessCom, disconnectChessCom } from "@/features/chesscom/actions";

function LichessRow({ lichessUsername }: { lichessUsername: string | null }) {
  const [isPending, startTransition] = useTransition();
  const [connecting, setConnecting] = useState(false);

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-surface-raised p-4">
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
  );
}

function ChessComRow({ chessComUsername }: { chessComUsername: string | null }) {
  const [isPending, startTransition] = useTransition();
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  function connect() {
    setError(null);
    startTransition(async () => {
      const result = await connectChessCom(input);
      if (!result.ok) {
        setError(result.error);
      } else {
        setInput("");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface-raised p-4">
      <div className="flex items-center gap-3">
        <SiChessdotcom aria-hidden="true" className="h-6 w-6 shrink-0 text-text" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-text">Chess.com</p>
          <p className="truncate text-xs text-text-faint">
            {chessComUsername ? `Connected as ${chessComUsername}` : "Not connected"}
          </p>
        </div>

        {chessComUsername ? (
          <button
            type="button"
            disabled={isPending}
            onClick={() => startTransition(() => disconnectChessCom())}
            className={secondaryButtonClass}
          >
            {isPending ? "Disconnecting…" : "Disconnect"}
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !isPending && connect()}
              placeholder="username"
              disabled={isPending}
              className="w-32 rounded-md border border-border bg-transparent px-2 py-1.5 text-sm text-text placeholder:text-text-faint disabled:opacity-50"
            />
            <button
              type="button"
              disabled={isPending || !input.trim()}
              onClick={connect}
              className={secondaryButtonClass}
            >
              {isPending ? "Checking…" : "Connect"}
            </button>
          </div>
        )}
      </div>
      {error && <p className="text-xs text-bad">{error}</p>}
    </div>
  );
}

export default function ConnectedAccounts({
  lichessUsername,
  chessComUsername,
}: {
  lichessUsername: string | null;
  chessComUsername: string | null;
}) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-text">Connected accounts</h2>
      <p className="mt-1 text-sm text-text-faint">
        Link Lichess or chess.com to import your games in one click and let the coach read your history.
      </p>

      <div className="mt-4 flex flex-col gap-3">
        <LichessRow lichessUsername={lichessUsername} />
        <ChessComRow chessComUsername={chessComUsername} />
      </div>
    </section>
  );
}
