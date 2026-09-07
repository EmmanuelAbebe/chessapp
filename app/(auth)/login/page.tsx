import SocialAuthButtons from "@/features/auth/components/SocialAuthButtons";

const ERROR_MESSAGES: Record<string, string> = {
  OAuthAccountNotLinked:
    "An account with that email already exists. Sign in with Google, then connect Lichess from your dashboard.",
  OAuthCallbackError:
    "Something went wrong finishing that sign-in. Please try again.",
  AccessDenied: "That sign-in was cancelled or denied.",
};

const LoginPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) => {
  const { error } = await searchParams;
  const errorMessage = error
    ? (ERROR_MESSAGES[error] ?? "Couldn't sign you in. Please try again.")
    : null;

  return (
    <div className="flex w-full max-w-132.5 flex-col items-center justify-center px-6 py-8 lg:py-0">
      <div className="w-full rounded-lg border border-border-soft bg-surface shadow-lg md:mt-0 sm:max-w-md xl:p-0">
        <div className="p-6 space-y-4 md:space-y-6 sm:p-8">
          <h1 className="text-xl font-bold leading-tight tracking-tight text-text md:text-2xl">
            Sign in to your account
          </h1>
          <p className="text-sm text-text-faint">
            Sign in with Google or Lichess to continue.
          </p>

          {errorMessage && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {errorMessage}
            </p>
          )}

          <SocialAuthButtons />
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
