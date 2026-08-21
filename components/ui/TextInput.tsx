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
        className={`block w-full rounded-lg border p-2.5 text-sm text-text placeholder-text-faint bg-surface-raised outline-none focus:ring-2 ${
          error
            ? "border-bad focus:border-bad focus:ring-bad"
            : success
              ? "border-good focus:border-good focus:ring-good"
              : "border-border focus:border-accent focus:ring-accent"
        } ${className ?? ""}`}
      />
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
