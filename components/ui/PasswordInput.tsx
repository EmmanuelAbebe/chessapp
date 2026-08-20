"use client";

import { useState, type InputHTMLAttributes } from "react";
import { FaEye, FaEyeSlash } from "react-icons/fa6";

export default function PasswordInput({
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        {...props}
        type={visible ? "text" : "password"}
        className={`pr-10 ${className ?? ""}`}
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
  );
}
