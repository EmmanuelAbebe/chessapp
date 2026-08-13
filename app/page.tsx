import Link from "next/link";

const FEATURES = [
  {
    title: "Engine truth",
    body: "Stockfish finds the best moves, evaluation swings, and tactical misses.",
  },
  {
    title: "Personal history",
    body: "Your recurring mistakes and habits shape what gets taught.",
  },
  {
    title: "AI coaching",
    body: "Explains why it happened and what to train next — in human terms.",
  },
];

export default function Home() {
  return (
    <div className="flex w-full flex-col items-center justify-center gap-16 px-4 py-16 text-center sm:px-6 sm:py-24">
      <div className="flex max-w-2xl flex-col gap-4">
        <h1 className="text-3xl font-bold">Chess AI Coach</h1>
        <p className="text-lg opacity-80">
          A chess coach that studies your games, finds recurring thinking
          errors, and teaches exactly what you need next.
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/board"
            className="rounded-lg bg-blue-600 px-5 py-2.5 font-medium text-white hover:bg-blue-700"
          >
            Start coaching
          </Link>
          <Link
            href="/login"
            className="rounded-lg px-5 py-2.5 font-medium underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </div>
      </div>

      <div className="grid max-w-3xl grid-cols-1 gap-8 sm:grid-cols-3">
        {FEATURES.map((feature) => (
          <div key={feature.title} className="flex flex-col gap-1">
            <h2 className="font-semibold">{feature.title}</h2>
            <p className="text-sm opacity-70">{feature.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
