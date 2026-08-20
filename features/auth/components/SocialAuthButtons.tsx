import { SOCIAL_PROVIDERS } from "../data";

export default function SocialAuthButtons() {
  return (
    <div className="flex flex-col gap-3">
      {SOCIAL_PROVIDERS.map(({ name, Icon }) => (
        <button
          key={name}
          type="button"
          className="flex w-full items-center justify-center gap-3 rounded-lg border border-neutral-700 bg-white px-5 py-2.5 text-sm font-medium text-neutral-900 transition hover:bg-neutral-100"
        >
          <Icon aria-hidden="true" className="h-4 w-4" />
          Continue with {name}
        </button>
      ))}
    </div>
  );
}
