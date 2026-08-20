"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import PasswordInput from "@/components/ui/PasswordInput";

export default function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!password || !confirmPassword) {
      setError("Fill in both fields.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setError(null);
    setSuccess(true);
  }

  if (!token) {
    return (
      <div className="flex w-full max-w-132.5 flex-col items-center justify-center px-6 py-8 lg:py-0">
        <div className="w-full rounded-lg border border-neutral-800 bg-neutral-900 shadow-lg md:mt-0 sm:max-w-md xl:p-0">
          <div className="p-6 space-y-4 md:space-y-6 sm:p-8">
            <h1 className="text-xl font-bold leading-tight tracking-tight text-neutral-100 md:text-2xl">
              Invalid or expired link
            </h1>
            <p className="text-sm text-neutral-400">
              This password reset link is invalid or has expired. Request a
              new one to continue.
            </p>
            <Link
              href="/forgot-password"
              className="inline-block w-full text-center text-white bg-blue-600 hover:bg-blue-700 focus:ring-4 focus:outline-none focus:ring-blue-800/50 font-medium rounded-lg text-sm px-5 py-2.5"
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
      <div className="w-full rounded-lg border border-neutral-800 bg-neutral-900 shadow-lg md:mt-0 sm:max-w-md xl:p-0">
        <div className="p-6 space-y-4 md:space-y-6 sm:p-8">
          <h1 className="text-xl font-bold leading-tight tracking-tight text-neutral-100 md:text-2xl">
            Set a new password
          </h1>

          {success ? (
            <div className="space-y-4 md:space-y-6">
              <p className="text-sm text-green-400">
                Your password has been reset.
              </p>
              <Link
                href="/login"
                className="inline-block w-full text-center text-white bg-blue-600 hover:bg-blue-700 focus:ring-4 focus:outline-none focus:ring-blue-800/50 font-medium rounded-lg text-sm px-5 py-2.5"
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
                  className="block mb-2 text-sm font-medium text-neutral-300"
                >
                  New password
                </label>
                <PasswordInput
                  name="password"
                  id="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  className="bg-neutral-800 border border-neutral-700 text-neutral-100 placeholder-neutral-500 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                />
              </div>

              <div>
                <label
                  htmlFor="confirm-password"
                  className="block mb-2 text-sm font-medium text-neutral-300"
                >
                  Confirm new password
                </label>
                <PasswordInput
                  name="confirm-password"
                  id="confirm-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="••••••••"
                  className="bg-neutral-800 border border-neutral-700 text-neutral-100 placeholder-neutral-500 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                />
              </div>

              {error ? <p className="text-sm text-red-400">{error}</p> : null}

              <button
                type="submit"
                className="w-full text-white bg-blue-600 hover:bg-blue-700 focus:ring-4 focus:outline-none focus:ring-blue-800/50 font-medium rounded-lg text-sm px-5 py-2.5 text-center"
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
