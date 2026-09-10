// All landing-page copy in one place, as data — keeps LandingPage.tsx about
// layout, not prose, and makes the wording easy to iterate on.

export const HERO = {
  eyebrow: "AI chess coaching",
  title: "Understand why you lost — not just where.",
  subtitle:
    "CoachMeChess pairs Stockfish's precision with a coach that explains your mistakes in plain language, then finds the habits behind them.",
  primaryCta: { label: "Start coaching", href: "/board" },
  secondaryCta: { label: "Sign in", href: "/login" },
  note: "Free to use. No account needed to open the board.",
};

// Honest capability chips — what the app actually is, not borrowed logos.
export const CAPABILITIES = [
  "Stockfish 18 in your browser",
  "Import from Lichess or any PGN",
  "Bring your own AI key",
  "Your data stays in your browser",
];

export const POSITIONING = {
  eyebrow: "Why it's different",
  title: "Analysis tools show you the move. They don't teach you the lesson.",
  body: [
    "An engine tells you the position was −2.4. It won't tell you that you had three pieces undeveloped and went pawn-grabbing, or that this is the fourth game running where the same thing happened.",
    "CoachMeChess starts from the engine's verdict and does the part the engine can't: names what you missed, ties it to the principle behind it, and gives you one concrete thing to change.",
  ],
};

export const STEPS = [
  {
    step: "01",
    title: "Play or import",
    body: "Play Stockfish at any strength, set up a position, or bring in your real games from a PGN or your connected Lichess account.",
  },
  {
    step: "02",
    title: "Analyse",
    body: "The engine finds the moments that decided the game. The coach explains each one: what happened, why it mattered, what you missed, and the principle behind it.",
  },
  {
    step: "03",
    title: "Improve",
    body: "Every review ends with one takeaway, one drill, and one theme to watch next game — not ten lessons you'll forget.",
  },
];

export const FEATURES = [
  {
    title: "Coaching grounded in the engine",
    body: "The coach never overrules Stockfish. Every “blunder” or “inaccuracy” is the engine's own call, computed from the evaluation swing — the AI's job is to phrase it and explain it, never to guess.",
  },
  {
    title: "The whole board, not just a chat",
    body: "Evaluation bar, move tree with variations, engine candidate arrows, position editor, and play-on-from-here against Stockfish — all on one screen.",
  },
  {
    title: "Your move-tree map",
    body: "Every game you've played or imported, merged into one explorable tree, so you can see which lines you actually score from and which ones quietly lose.",
  },
  {
    title: "Your playing style, measured",
    body: "Openings, habits, phase strengths, time-pressure tendencies, and a personality read — all computed from your real games, not a quiz.",
  },
];

export const VISION = {
  eyebrow: "In development",
  title: "Next: a model of how you play",
  body: "We're building a system that learns from millions of human games, places you among players with a similar style, and shows you what the stronger ones do differently — so your training fits the way you actually play, instead of generic advice to “be more solid.”",
};

export const ABOUT = {
  eyebrow: "About",
  title: "A coaching tool the author wanted to exist",
  body: [
    "CoachMeChess is an independent project. It came out of a simple frustration: engine analysis is everywhere, but it answers “was that move good?” far better than “why do I keep doing this?”",
    "The coaching model is deliberately strict. Every explanation follows the same shape — what happened, why it matters, what you missed, the principle, one action — and every review ends with a single next step. The goal isn't more information. It's the right lesson at the right level.",
  ],
  audience: [
    "Beginners who keep hanging pieces and want to know the pattern, not just the move",
    "Intermediate players who reach good positions and can't convert them",
    "Anyone who wants a second opinion on their own analysis",
  ],
};

export const FAQ = [
  {
    q: "Is it free?",
    a: "The board, engine analysis, import, and the statistics are free. For AI coaching you bring your own provider key (Google, OpenAI, Anthropic, or Groq), or use the app's shared Google key where available.",
  },
  {
    q: "Do I need a Lichess account?",
    a: "No. You can play on the board or paste a PGN without signing in. Connecting Lichess lets the app import your game history automatically and attribute games to you.",
  },
  {
    q: "Which engine does it use?",
    a: "Stockfish 18 (the lite single-threaded build), running entirely in your browser. Nothing is sent to a server for evaluation.",
  },
  {
    q: "What happens to my data?",
    a: "Your imported games and your AI key are stored in your browser's local storage. Sign-in is handled by Google or Lichess; the app keeps only what those providers return.",
  },
  {
    q: "Can it coach at my level?",
    a: "The coach adapts its language and focus to your rating and the kind of mistakes you tend to make — short and concrete for beginners, plan- and alternative-focused for stronger players.",
  },
];

export const FINAL_CTA = {
  title: "Ready to see what your games are telling you?",
  cta: { label: "Start coaching", href: "/board" },
};

export const FOOTER = {
  tagline: "A chess coach that studies your games and teaches what to train next.",
  columns: [
    {
      heading: "Product",
      links: [
        { label: "Board", href: "/board" },
        { label: "Map", href: "/map" },
        { label: "Dashboard", href: "/dashboard" },
        { label: "Sign in", href: "/login" },
      ],
    },
  ],
  disclaimer:
    "CoachMeChess is an independent project. Not affiliated with Lichess or the Stockfish project.",
};
