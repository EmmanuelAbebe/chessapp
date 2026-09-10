# Player-behaviour model (`ml/`)

The offline pipeline + inference service behind the player profile shown on
`/dashboard/statistics`. See `../.claude/plans/zippy-dreaming-frog.md` for the
full design and rationale. This directory is self-contained Python; it is not
part of the Next.js build.

## What it does

1. **Pipeline** (`pipeline/`) — learns a *style + skill* representation of human
   chess behaviour from the Lichess open database, and a reference table of
   ~40–70k players placed in that space.
2. **Service** (`service/`) — takes one user's PGN, places them in the space,
   finds stylistically-similar but stronger players, and reports where they
   deviate → focus areas.

## Setup

```bash
cd ml
make venv                 # .venv + requirements.txt
source .venv/bin/activate
```

Stage 03 needs a native Stockfish binary at `./stockfish/stockfish`
(download the one matching the VM's arch from stockfishchess.org).

## Running the pipeline

Edit `config.yaml` (`lichess.month`, `ingest.target_games`), then:

```bash
make ingest          # 01 - stream one monthly dump -> data/<month>/{games,moves}/  (resumable)
make features        # 02 - per-ply features        -> data/<month>/move_features/
make engine-labels   # 03 - Stockfish sample labels (run on a cloud spot VM)
make feature-models  # 04 - train the tacticality / complexity / move-quality models
make game-agg        # 05
make player-vectors  # 06
make skill style traits export   # 07-10
make validate        # 11 - artifacts/validation_report.md
```

`make ingest` streams the `.pgn.zst` without ever storing it — only the compact
parquet output touches disk. It checkpoints every `checkpoint_every` kept games;
re-running resumes from `data/<month>/checkpoint.json`. Run it again with a
different `lichess.month` to append a second month (more games per player).

## Tests

```bash
.venv/bin/python tests/smoke.py    # stages 01-02, no download
```

## Layout

| Path | Purpose |
|---|---|
| `config.yaml` | every threshold / path / sample size |
| `pipeline/common/` | shared chess + PGN + eval helpers (kept in sync with the web app's `move-analysis.ts` / `eval-format.ts`) |
| `pipeline/NN_*.py` | one file per stage |
| `service/` | FastAPI inference service |
| `data/`, `artifacts/`, `stockfish/` | gitignored |
