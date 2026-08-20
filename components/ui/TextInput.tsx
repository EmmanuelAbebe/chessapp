import type { InputHTMLAttributes } from "react";
import { FaCheck } from "react-icons/fa6";

export default function TextInput({
  error,
  success,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  error?: string;
  success?: string;
}) {
  return (
    <div>
      <input
        {...props}
        aria-invalid={error ? true : undefined}
        className={`block w-full rounded-lg border p-2.5 text-sm text-neutral-100 placeholder-neutral-500 bg-neutral-800 outline-none focus:ring-2 ${
          error
            ? "border-red-500 focus:border-red-500 focus:ring-red-500"
            : success
              ? "border-green-500 focus:border-green-500 focus:ring-green-500"
              : "border-neutral-700 focus:border-blue-500 focus:ring-blue-500"
        } ${className ?? ""}`}
      />
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
