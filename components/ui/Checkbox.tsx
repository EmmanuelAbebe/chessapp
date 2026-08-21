import type { InputHTMLAttributes } from "react";

export default function Checkbox({
  label,
  error,
  id,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  id: string;
  error?: string;
}) {
  return (
    <div>
      <div className="flex items-start">
        <div className="flex h-5 items-center">
          <input
            {...props}
            id={id}
            type="checkbox"
            className="h-4 w-4 rounded border border-border bg-surface-raised focus:ring-2 focus:ring-accent"
          />
        </div>
        <div className="ml-3 text-sm">
          <label htmlFor={id} className="text-text-dim">
            {label}
          </label>
        </div>
      </div>
      {error ? <p className="mt-1.5 text-sm text-bad">{error}</p> : null}
    </div>
  );
}
