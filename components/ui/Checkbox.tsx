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
            className="h-4 w-4 rounded border border-neutral-700 bg-neutral-800 focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="ml-3 text-sm">
          <label htmlFor={id} className="text-neutral-400">
            {label}
          </label>
        </div>
      </div>
      {error ? <p className="mt-1.5 text-sm text-red-400">{error}</p> : null}
    </div>
  );
}
