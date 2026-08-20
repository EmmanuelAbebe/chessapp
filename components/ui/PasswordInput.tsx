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
          className={`block w-full rounded-lg border p-2.5 pr-10 text-sm text-neutral-100 placeholder-neutral-500 bg-neutral-800 outline-none focus:ring-2 ${
            error
              ? "border-red-500 focus:border-red-500 focus:ring-red-500"
              : success
                ? "border-green-500 focus:border-green-500 focus:ring-green-500"
                : "border-neutral-700 focus:border-blue-500 focus:ring-blue-500"
          } ${className ?? ""}`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-neutral-500 transition hover:text-neutral-300"
        >
          {visible ? (
            <FaEyeSlash aria-hidden="true" className="h-4 w-4" />
          ) : (
            <FaEye aria-hidden="true" className="h-4 w-4" />
          )}
        </button>
      </div>
      {error ? (
        <p className="mt-1.5 text-sm text-red-400">{error}</p>
      ) : success ? (
        <p className="mt-1.5 flex items-center gap-1.5 text-sm text-green-400">
          <FaCheck aria-hidden="true" className="h-3 w-3" />
          {success}
        </p>
      ) : null}
    </div>
  );
}
