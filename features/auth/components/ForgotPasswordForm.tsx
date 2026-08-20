"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!email.trim()) {
      setError("Enter your email address.");
      return;
    }
    setError(null);
    setSubmitted(true);
  }

  return (
    <div className="flex w-full max-w-132.5 flex-col items-center justify-center px-6 py-8 lg:py-0">
      <div className="w-full rounded-lg border border-neutral-800 bg-neutral-900 shadow-lg md:mt-0 sm:max-w-md xl:p-0">
        <div className="p-6 space-y-4 md:space-y-6 sm:p-8">
          <h1 className="text-xl font-bold leading-tight tracking-tight text-neutral-100 md:text-2xl">
            Forgot your password?
          </h1>

          {submitted ? (
            <div className="space-y-4 md:space-y-6">
              <p className="text-sm text-neutral-300">
                If an account exists for <strong>{email}</strong>, we&apos;ve
                sent a link to reset your password.
              </p>
              <Link
                href="/login"
                className="inline-block w-full text-center text-white bg-blue-600 hover:bg-blue-700 focus:ring-4 focus:outline-none focus:ring-blue-800/50 font-medium rounded-lg text-sm px-5 py-2.5"
              >
                Back to sign in
              </Link>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="space-y-4 md:space-y-6"
              noValidate
            >
              <p className="text-sm text-neutral-400">
                Enter the email associated with your account and we&apos;ll
                send you a link to reset your password.
              </p>

              <div>
                <label
                  htmlFor="email"
                  className="block mb-2 text-sm font-medium text-neutral-300"
                >
                  Your email
                </label>
                <input
                  type="email"
                  name="email"
                  id="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="bg-neutral-800 border border-neutral-700 text-neutral-100 placeholder-neutral-500 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                  placeholder="name@company.com"
                />
              </div>

              {error ? <p className="text-sm text-red-400">{error}</p> : null}

              <button
                type="submit"
                className="w-full text-white bg-blue-600 hover:bg-blue-700 focus:ring-4 focus:outline-none focus:ring-blue-800/50 font-medium rounded-lg text-sm px-5 py-2.5 text-center"
              >
                Send reset link
              </button>

              <p className="text-sm font-light text-neutral-400">
                Remember your password?{" "}
                <Link
                  href="/login"
                  className="font-medium text-blue-400 hover:underline"
                >
                  Sign in
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
