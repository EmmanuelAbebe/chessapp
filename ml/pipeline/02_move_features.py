"""Stage 02 — per-ply derived features.

Replays every game once (python-chess), computing the signals the trait
layer needs: win-probability loss, move classification, phase, material
swing, king-distance, SEE, pawn tension, think-time, legal-move count, and
opening-book membership. Reads ``data/<month>/{games,moves}/``; writes
``data/<month>/move_features/``.

Two phases: (A) replay + per-ply features incl. ``epd_before`` for early
plies, (B) a global count of (position, move) pairs to mark ``in_book`` and
``plies_since_book_exit``. The per-ply extraction itself lives in
``pipeline/common/movefeatures.py`` — shared with the inference service so
a user's games are computed exactly the same way as the reference set.

    python pipeline/02_move_features.py
"""

from __future__ import annotations

import pathlib
import sys

import polars as pl
from tqdm import tqdm

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from pipeline.common import config as cfgmod  # noqa: E402
from pipeline.common.filters import parse_time_control  # noqa: E402
from pipeline.common.movefeatures import (  # noqa: E402
    FEATURE_SCHEMA,
    apply_book_tags,
    features_for_game,
)


def _phase_a(cfg, month_dir, thr, book_max_ply):
    raw_dir = month_dir / "move_features_raw"
    raw_dir.mkdir(exist_ok=True)
    games = pl.read_parquet(month_dir / "games" / "*.parquet").select(
        "game_id", "time_control"
    )
    inc_by_game = {}
    base_by_game = {}
    for gid, tc in zip(games["game_id"], games["time_control"]):
        parsed = parse_time_control(tc) or (0, 0)
        base_by_game[gid], inc_by_game[gid] = parsed

    # Sub-batched within each source partition (not just one flush per
    # partition) - this machine runs with almost no free RAM/swap
    # alongside the user's own desktop apps, so peak memory matters more
    # than usual. Each batch is its own skip-if-exists output file, so a
    # kill partway through a partition loses at most one small batch,
    # not the whole 2000-game partition.
    BATCH_GAMES = 200

    move_parts = sorted((month_dir / "moves").glob("*.parquet"))
    for part in tqdm(move_parts, desc="phase A (replay)"):
        moves = pl.read_parquet(part).sort("game_id", "ply")
        game_ids = moves["game_id"].unique(maintain_order=True).to_list()

        for batch_idx, start in enumerate(range(0, len(game_ids), BATCH_GAMES)):
            out_path = raw_dir / f"{part.stem}_{batch_idx:03d}.parquet"
            if out_path.exists():
                continue  # resumable: this batch was already written

            batch_ids = game_ids[start : start + BATCH_GAMES]
            batch_moves = moves.filter(pl.col("game_id").is_in(batch_ids))
            out: list[dict] = []
            for gid, grp in batch_moves.group_by("game_id", maintain_order=True):
                gid = gid[0] if isinstance(gid, tuple) else gid
                rows = features_for_game(
                    grp.to_dicts(),
                    inc_by_game.get(gid, 0),
                    base_by_game.get(gid, 0),
                    book_max_ply,
                    thr,
                )
                if rows:
                    out.extend(rows)
            if out:
                pl.DataFrame(out, schema=FEATURE_SCHEMA).write_parquet(out_path)
    return raw_dir


def _phase_b(month_dir, raw_dir, book_min_count):
    out_dir = month_dir / "move_features"
    out_dir.mkdir(exist_ok=True)

    counts = (
        pl.scan_parquet(raw_dir / "*.parquet")
        .filter(pl.col("epd_before").is_not_null())
        .group_by("epd_before", "uci")
        .len()
        .filter(pl.col("len") >= book_min_count)
        .collect()
    )
    # persisted for stage 10 / the service (move-rarity / "leaves book at move X")
    counts.write_parquet(month_dir / "move_freq.parquet")
    book_set = set(zip(counts["epd_before"], counts["uci"]))
    print(f"opening book: {len(book_set):,} (position, move) pairs")

    for part in tqdm(sorted(raw_dir.glob("*.parquet")), desc="phase B (book)"):
        if (out_dir / part.name).exists():
            continue  # resumable, same as phase A
        df = apply_book_tags(pl.read_parquet(part), book_set)
        df.write_parquet(out_dir / part.name)


def run() -> None:
    cfg = cfgmod.load()
    mf = cfg["move_features"]
    month_dir = cfgmod.month_dir(cfg)
    raw_dir = _phase_a(cfg, month_dir, mf["classify"], mf["book_max_ply"])
    _phase_b(month_dir, raw_dir, mf["book_min_count"])
    print("done -> data/<month>/move_features/")


if __name__ == "__main__":
    run()
