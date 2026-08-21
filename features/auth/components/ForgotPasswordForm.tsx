"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import TextInput from "@/components/ui/TextInput";
import { useValidatedField } from "@/lib/hooks/useValidatedField";
import { validateEmail } from "@/lib/validation";

export default function ForgotPasswordForm() {
  const email = useValidatedField("", (value) =>
    validateEmail(value, { required: true }),
  );
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!email.validateNow()) return;
    setSubmitted(true);
  }

  return (
    <div className="flex w-full max-w-132.5 flex-col items-center justify-center px-6 py-8 lg:py-0">
      <div className="w-full rounded-lg border border-border-soft bg-surface shadow-lg md:mt-0 sm:max-w-md xl:p-0">
        <div className="p-6 space-y-4 md:space-y-6 sm:p-8">
          <h1 className="text-xl font-bold leading-tight tracking-tight text-text md:text-2xl">
            Forgot your password?
          </h1>

          {submitted ? (
            <div className="space-y-4 md:space-y-6">
              <p className="text-sm text-text">
                If an account exists for <strong>{email.value}</strong>,
                we&apos;ve sent a link to reset your password.
              </p>
              <Link
                href="/login"
                className="inline-block w-full text-center text-text bg-accent hover:brightness-90 focus:ring-4 focus:outline-none focus:ring-accent/50 font-medium rounded-lg text-sm px-5 py-2.5"
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
              <p className="text-sm text-text-dim">
                Enter the email associated with your account and we&apos;ll
                send you a link to reset your password.
              </p>

              <div>
                <label
                  htmlFor="email"
                  className="block mb-2 text-sm font-medium text-text"
                >
                  Your email
                </label>
                <TextInput
                  type="email"
                  name="email"
                  id="email"
                  value={email.value}
                  onChange={email.onChange}
                  onBlur={email.onBlur}
                  error={email.error}
                  success={email.isValid ? "Looks good!" : undefined}
                  placeholder="name@company.com"
                />
              </div>

              <button
                type="submit"
                className="w-full text-text bg-accent hover:brightness-90 focus:ring-4 focus:outline-none focus:ring-accent/50 font-medium rounded-lg text-sm px-5 py-2.5 text-center"
              >
                Send reset link
              </button>

              <p className="text-sm font-light text-text-dim">
                Remember your password?{" "}
                <Link
                  href="/login"
                  className="font-medium text-accent hover:underline"
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
