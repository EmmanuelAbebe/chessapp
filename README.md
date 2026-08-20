# CoachMeChess

A minimalist chess coaching web app. Stockfish finds what went wrong; an AI coach explains why, ties it to the player's history, and prescribes the next drill.

## Pages

- `/` — marketing + home
- `/board` — the chess board, engine analysis, and AI coaching chat (single-page workspace)
- `/dashboard` — profile, subscription, statistics, and settings (nested routes)
- `/login`, `/register`, `/forgot-password`, `/reset-password` — auth

See `docs/product-notes.md` for the underlying product/coaching model.

## Getting started

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).
