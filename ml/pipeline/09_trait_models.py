"""Stage 09 — context-conditioned traits.

Trains a population model of expected per-move ``wp_loss`` given only the
*context* of the move (complexity, tacticality, clock, book recency, phase,
defending, tension). A player's trait score for a context is then the mean
of ``actual - expected`` over their own moves in that context — i.e. how
much worse they do than a typical player *in the same kind of position* —
z-scored across the reference population. Positive = weakness.

Reads ``move_features/`` + ``games/`` + ``player_vectors_full.parquet``;
writes ``player_vectors_final.parquet`` and ``artifacts/trait/``.

    python pipeline/09_trait_models.py
"""

from __future__ import annotations

import json
import pathlib
import pickle
import sys

import lightgbm as lgb
import numpy as np
import polars as pl

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from pipeline.common import config as cfgmod  # noqa: E402
from pipeline.common.features import TRAITS  # noqa: E402
from pipeline.common.filters import parse_time_control  # noqa: E402

CONTEXT = [
    "complexity_pred", "has_tactic_pred", "only_move_pred", "clock_frac",
    "plies_since_book_exit", "phase_code", "is_defending", "st_pawn_tension",
    "st_material_imbalance", "ply",
]

# bucket filter (polars expr) per trait — mean residual over these moves
BUCKETS = {
    "trait_attention": "(pl.col('has_tactic_pred') < 0.2) & (pl.col('complexity_pred') < 15) & (pl.col('clock_frac').fill_null(1) > 0.3)",
    "trait_tactical": "pl.col('has_tactic_pred') >= 0.5",
    "trait_calculation": "pl.col('complexity_pred') >= 25",
    "trait_time_pressure": "pl.col('clock_frac') < 0.15",
    "trait_opening_transition": "pl.col('plies_since_book_exit').is_between(1, 6)",
    "trait_defense": "pl.col('is_defending')",
}
assert list(BUCKETS) == TRAITS, "BUCKETS keys must match common.features.TRAITS"
PHASE_CODE = {"opening": 0, "middlegame": 1, "endgame": 2}
SAMPLE_TRAIN = 2_000_000
SAMPLE_PER_PLAYER = 60


def run() -> None:
    cfg = cfgmod.load()
    month_dir = cfgmod.month_dir(cfg)
    out = cfg["paths"]["artifacts_dir"] / "trait"
    out.mkdir(parents=True, exist_ok=True)

    games = pl.read_parquet(month_dir / "games" / "*.parquet").select(
        "game_id", "white", "black", "time_control"
    )
    tc = [parse_time_control(t) or (0, 0) for t in games["time_control"]]
    games = games.with_columns(
        tc_base=pl.Series([b for b, _ in tc], dtype=pl.Int32),
        white_hash=pl.col("white").str.to_lowercase().hash(seed=1).cast(pl.Utf8),
        black_hash=pl.col("black").str.to_lowercase().hash(seed=1).cast(pl.Utf8),
    )

    lf = (
        pl.scan_parquet(month_dir / "move_features" / "*.parquet")
        .join(games.lazy().select("game_id", "tc_base", "white_hash", "black_hash"), on="game_id")
        .filter(pl.col("wp_loss").is_not_null())
        .with_columns(
            player_hash=pl.when(pl.col("mover") == "w").then("white_hash").otherwise("black_hash"),
            clock_frac=pl.when(pl.col("tc_base") > 0)
            .then(pl.col("clock_cs") / (pl.col("tc_base") * 100))
            .otherwise(None),
            phase_code=pl.col("phase").replace_strict(PHASE_CODE, default=1).cast(pl.Int8),
        )
        .select("player_hash", "wp_loss", *CONTEXT)
    )

    df = lf.collect()
    print(f"{df.height:,} usable plies")

    train = df.sample(min(SAMPLE_TRAIN, df.height), seed=7)
    model = lgb.LGBMRegressor(
        n_estimators=400, learning_rate=0.04, num_leaves=63, subsample=0.8,
        colsample_bytree=0.8, min_child_samples=100, random_state=7, n_jobs=-1, verbosity=-1,
    ).fit(train.select(CONTEXT).fill_null(0).to_numpy(), train["wp_loss"].to_numpy())
    model.booster_.save_model(str(out / "wp_loss.txt"))
    (out / "spec.json").write_text(json.dumps({"context": CONTEXT, "buckets": BUCKETS}, indent=2))

    # per-player residuals, sampled
    pv = pl.read_parquet(month_dir / "player_vectors_full.parquet")
    ref_players = set(pv["player_hash"])
    scored = (
        df.filter(pl.col("player_hash").is_in(list(ref_players)))
        .with_columns(_r=pl.int_range(pl.len()).shuffle(seed=3).over("player_hash"))
        .filter(pl.col("_r") < SAMPLE_PER_PLAYER)
        .drop("_r")
    )
    scored = scored.with_columns(
        resid=pl.col("wp_loss")
        - pl.Series(model.predict(scored.select(CONTEXT).fill_null(0).to_numpy()))
    )

    trait_cols = {}
    for name, expr in BUCKETS.items():
        b = scored.filter(eval(expr, {"pl": pl}))  # noqa: S307 — trusted, module-local
        per_player = b.group_by("player_hash").agg(pl.col("resid").mean().alias(name))
        trait_cols[name] = per_player

    final = pv
    for name, per_player in trait_cols.items():
        final = final.join(per_player, on="player_hash", how="left")
        mu, sd = final[name].mean(), final[name].std() or 1.0
        final = final.with_columns(
            ((pl.col(name).fill_null(mu) - mu) / sd).alias(name)
        )

    final.write_parquet(month_dir / "player_vectors_final.parquet")
    print(f"traits added: {', '.join(TRAITS)}")
    print("done -> player_vectors_final.parquet")


if __name__ == "__main__":
    run()
