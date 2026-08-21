"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import PasswordInput from "@/components/ui/PasswordInput";
import { useValidatedField } from "@/lib/hooks/useValidatedField";
import { validateMatch, validatePassword } from "@/lib/validation";

export default function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const password = useValidatedField("", (value) =>
    validatePassword(value, { required: true }),
  );
  const confirmPassword = useValidatedField("", (value) =>
    validateMatch(value, password.value, "Passwords"),
  );
  const [success, setSuccess] = useState(false);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const isPasswordValid = password.validateNow();
    const isConfirmValid = confirmPassword.validateNow();
    if (!isPasswordValid || !isConfirmValid) return;
    setSuccess(true);
  }

  if (!token) {
    return (
      <div className="flex w-full max-w-132.5 flex-col items-center justify-center px-6 py-8 lg:py-0">
        <div className="w-full rounded-lg border border-border-soft bg-surface shadow-lg md:mt-0 sm:max-w-md xl:p-0">
          <div className="p-6 space-y-4 md:space-y-6 sm:p-8">
            <h1 className="text-xl font-bold leading-tight tracking-tight text-text md:text-2xl">
              Invalid or expired link
            </h1>
            <p className="text-sm text-text-dim">
              This password reset link is invalid or has expired. Request a
              new one to continue.
            </p>
            <Link
              href="/forgot-password"
              className="inline-block w-full text-center text-text bg-accent hover:brightness-90 focus:ring-4 focus:outline-none focus:ring-accent/50 font-medium rounded-lg text-sm px-5 py-2.5"
            >
              Request a new link
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-132.5 flex-col items-center justify-center px-6 py-8 lg:py-0">
      <div className="w-full rounded-lg border border-border-soft bg-surface shadow-lg md:mt-0 sm:max-w-md xl:p-0">
        <div className="p-6 space-y-4 md:space-y-6 sm:p-8">
          <h1 className="text-xl font-bold leading-tight tracking-tight text-text md:text-2xl">
            Set a new password
          </h1>

          {success ? (
            <div className="space-y-4 md:space-y-6">
              <p className="text-sm text-good">
                Your password has been reset.
              </p>
              <Link
                href="/login"
                className="inline-block w-full text-center text-text bg-accent hover:brightness-90 focus:ring-4 focus:outline-none focus:ring-accent/50 font-medium rounded-lg text-sm px-5 py-2.5"
              >
                Sign in
              </Link>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="space-y-4 md:space-y-6"
              noValidate
            >
              <div>
                <label
                  htmlFor="password"
                  className="block mb-2 text-sm font-medium text-text"
                >
                  New password
                </label>
                <PasswordInput
                  name="password"
                  id="password"
                  value={password.value}
                  onChange={password.onChange}
                  onBlur={password.onBlur}
                  error={password.error}
                  success={password.isValid ? "Looks good!" : undefined}
                  placeholder="••••••••"
                />
              </div>

              <div>
                <label
                  htmlFor="confirm-password"
                  className="block mb-2 text-sm font-medium text-text"
                >
                  Confirm new password
                </label>
                <PasswordInput
                  name="confirm-password"
                  id="confirm-password"
                  value={confirmPassword.value}
                  onChange={confirmPassword.onChange}
                  onBlur={confirmPassword.onBlur}
                  error={confirmPassword.error}
                  success={confirmPassword.isValid ? "Passwords match!" : undefined}
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                className="w-full text-text bg-accent hover:brightness-90 focus:ring-4 focus:outline-none focus:ring-accent/50 font-medium rounded-lg text-sm px-5 py-2.5 text-center"
              >
                Reset password
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
