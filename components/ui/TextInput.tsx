import type { InputHTMLAttributes } from "react";

export default function TextInput({
  error,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { error?: string }) {
  return (
    <div>
      <input
        {...props}
        aria-invalid={error ? true : undefined}
        className={`block w-full rounded-lg border p-2.5 text-sm text-neutral-100 placeholder-neutral-500 bg-neutral-800 outline-none focus:ring-2 ${
          error
            ? "border-red-500 focus:border-red-500 focus:ring-red-500"
            : "border-neutral-700 focus:border-blue-500 focus:ring-blue-500"
        } ${className ?? ""}`}
      />
      {error ? <p className="mt-1.5 text-sm text-red-400">{error}</p> : null}
    </div>
  );
}
