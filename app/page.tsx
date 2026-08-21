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

const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Play",
    body: "Play a game on the board — against yourself for now, Stockfish soon.",
  },
  {
    step: "02",
    title: "Review",
    body: "The engine finds exactly where the position turned, and why.",
  },
  {
    step: "03",
    title: "Train",
    body: "Your coach explains the pattern and gives you what to work on next.",
  },
];

export default function Home() {
  return (
    <div className="flex w-full flex-1 flex-col items-center gap-20 px-4 py-16 text-center sm:px-6 sm:py-24">
      <div className="flex max-w-2xl flex-col items-center gap-4">
        <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">
          CoachMeChess
        </h1>
        <p className="text-lg text-neutral-300">
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

      <div className="grid w-full max-w-3xl grid-cols-1 gap-8 sm:grid-cols-3">
        {FEATURES.map((feature) => (
          <div key={feature.title} className="flex flex-col gap-1">
            <h2 className="text-base font-semibold text-white">
              {feature.title}
            </h2>
            <p className="text-sm text-neutral-400">{feature.body}</p>
          </div>
        ))}
      </div>

      <div className="flex w-full max-w-3xl flex-col gap-8">
        <h2 className="text-sm font-semibold tracking-wide text-neutral-500">
          How it works
        </h2>
        <div className="grid grid-cols-1 gap-8 text-left sm:grid-cols-3">
          {HOW_IT_WORKS.map((item) => (
            <div key={item.step} className="flex flex-col gap-1">
              <span className="font-mono text-xs text-neutral-600">
                {item.step}
              </span>
              <h3 className="text-base font-semibold text-white">
                {item.title}
              </h3>
              <p className="text-sm text-neutral-400">{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
