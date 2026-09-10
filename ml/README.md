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

Stage 03 needs a native Stockfish binary at `./stockfish/stockfish`:

```bash
mkdir -p stockfish && curl -sL \
  https://github.com/official-stockfish/Stockfish/releases/download/sf_17.1/stockfish-ubuntu-x86-64-avx2.tar \
  | tar x -C /tmp && cp /tmp/stockfish/stockfish-ubuntu-x86-64-avx2 stockfish/stockfish
```

(pick the build matching the VM's CPU; `avx2` for anything recent). It runs
fine but very slowly on a weak/loaded laptop — stage 03 is meant for a
cloud spot VM.

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
.venv/bin/python tests/smoke.py           # stages 01-02, no download
.venv/bin/python tests/smoke_stage03.py   # stage 03 pure functions
.venv/bin/python tests/smoke_stage04.py   # stage 04 train + apply, synthetic data
.venv/bin/python tests/engine_check.py    # stage 03 vs a real Stockfish (needs the binary)
```

## Layout

| Path | Purpose |
|---|---|
| `config.yaml` | every threshold / path / sample size |
| `pipeline/common/` | shared chess + PGN + eval helpers (kept in sync with the web app's `move-analysis.ts` / `eval-format.ts`) |
| `pipeline/NN_*.py` | one file per stage |
| `service/` | FastAPI inference service |
| `data/`, `artifacts/`, `stockfish/` | gitignored |
