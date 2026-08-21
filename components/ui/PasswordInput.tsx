"use client";

import { useState, type InputHTMLAttributes } from "react";
import { FaCheck, FaEye, FaEyeSlash } from "react-icons/fa6";

export default function PasswordInput({
  error,
  success,
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  error?: string;
  success?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <div className="relative">
        <input
          {...props}
          type={visible ? "text" : "password"}
          aria-invalid={error ? true : undefined}
          className={`block w-full rounded-lg border p-2.5 pr-10 text-sm text-text placeholder-text-faint bg-surface-raised outline-none focus:ring-2 ${
            error
              ? "border-bad focus:border-bad focus:ring-bad"
              : success
                ? "border-good focus:border-good focus:ring-good"
                : "border-border focus:border-accent focus:ring-accent"
          } ${className ?? ""}`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-text-faint transition hover:text-text"
        >
          {visible ? (
            <FaEyeSlash aria-hidden="true" className="h-4 w-4" />
          ) : (
            <FaEye aria-hidden="true" className="h-4 w-4" />
          )}
        </button>
      </div>
      {error ? (
        <p className="mt-1.5 text-sm text-bad">{error}</p>
      ) : success ? (
        <p className="mt-1.5 flex items-center gap-1.5 text-sm text-good">
          <FaCheck aria-hidden="true" className="h-3 w-3" />
          {success}
        </p>
      ) : null}
    </div>
  );
}
