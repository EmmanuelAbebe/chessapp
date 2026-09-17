"""Builds one user's profile: parse their PGN, compute features exactly the
way the reference population was computed, project into the style/skill
space, and compare against a stronger style-neighbourhood cohort.

The heavy lifting — per-ply features, book tagging, feature-model scoring,
per-game/per-player aggregation, and the skill/style projection — all comes
from ``pipeline/common/*``, unchanged from what built the reference set.
This module is the glue: PGN in, ``schemas.Profile`` out.

Processing is chunked (``build_profile_chunks``) rather than one big batch:
a request for thousands of games would otherwise hold every game's full
per-move feature dataframe (dozens of scored columns per ply) in memory at
once, which is the actual bottleneck at scale, not wall-clock time alone.
Each batch is scored and folded into small running state - accumulated
per-game rows (``ga``, one row per game), a slim two-column complexity/
ply frame, and a bounded top-N example-position candidate list per
feature - then its wide per-move dataframe is dropped before the next
batch. ``build_profile`` is a thin wrapper that just drains the generator
and returns its last snapshot, so existing single-shot callers are
unaffected.
"""

from __future__ import annotations

import io
import math
import time
from collections.abc import Iterator

import chess
import chess.engine
import numpy as np
import polars as pl
from sklearn.linear_model import LinearRegression

from pipeline.common import pgn as pgnmod
from pipeline.common.featuremodels import score as score_features
from pipeline.common.features import MODELLED, SITUATION_BUCKETS
from pipeline.common.filters import parse_time_control, speed_bucket
from pipeline.common.gameagg import enrich_plies, game_level_agg, moves_agg
from pipeline.common.movefeatures import FEATURE_SCHEMA, apply_book_tags, features_for_game
from pipeline.common.playeragg import aggregate_players
from pipeline.common.project import Artifacts
from service import engine as enginemod
from service.schemas import (
    Coaching, Cohort, ComplexityByMoveBucket, ExamplePosition, PerGameStats,
    PhaseAccuracy, Profile, SituationalGap, Skill, Source, Style, StyleAxis, StyleTrajectoryPoint,
)

_VALID_RESULTS = {"1-0", "0-1", "1/2-1/2"}
_CASTLE_SIDE = {"O-O": "k", "O-O-O": "q"}

DEFAULT_BATCH_SIZE = 25


class NotEnoughGames(Exception):
    pass


_Z_CAP = 8.0


def _robust_z(value: float, median: float, mad: float) -> float:
    """(value - median) / MAD, clipped to +/-_Z_CAP. A near-degenerate peer
    distribution (most players share one exact value - conversion_rate=1.0
    is common in a small sample) makes MAD near zero, and an unclipped z
    can blow up to an absurd, meaningless magnitude for one real outlier."""
    mad = mad or 1e-6
    return float(np.clip((value - median) / mad, -_Z_CAP, _Z_CAP))


# --- 1. parse ----------------------------------------------------------------

def _parse_games(pgn_text: str, time_class: str, min_plies: int) -> tuple[list[dict], list[list[dict]]]:
    games_meta, all_moves = [], []
    for headers_text, movetext in pgnmod.iter_raw_games(io.StringIO(pgn_text), 1 << 20):
        h = pgnmod.parse_headers(headers_text)
        if speed_bucket(h.get("TimeControl")) != time_class:
            continue
        if h.get("Result") not in _VALID_RESULTS:
            continue
        try:
            parsed = pgnmod.parse_full_game(headers_text, movetext)
        except Exception:  # noqa: BLE001
            continue
        if parsed is None:
            continue
        game, game_id, move_rows, _evaled, _clocked = parsed
        if len(move_rows) < min_plies:
            continue
        gh = game.headers
        games_meta.append(
            {
                "game_id": game_id, "white": gh.get("White", ""), "black": gh.get("Black", ""),
                "white_elo": int(gh.get("WhiteElo", 0) or 0), "black_elo": int(gh.get("BlackElo", 0) or 0),
                "result": gh.get("Result"), "eco": gh.get("ECO"),
                "utc_date": gh.get("UTCDate") or gh.get("Date") or "",
                "time_control": gh.get("TimeControl"),
            }
        )
        all_moves.append(move_rows)
    return games_meta, all_moves


def _select_my_recent_games(
    games_meta: list[dict], all_moves: list[list[dict]], username: str, max_games: int
) -> tuple[list[dict], list[list[dict]]]:
    uname = username.strip().lower()
    kept_meta, kept_moves = [], []
    for meta, moves in zip(games_meta, all_moves):
        if uname == meta["white"].strip().lower():
            side = "w"
        elif uname == meta["black"].strip().lower():
            side = "b"
        else:
            continue  # defensive: not actually one of this user's games
        kept_meta.append({**meta, "my_side": side})
        kept_moves.append(moves)
    order = sorted(range(len(kept_meta)), key=lambda i: kept_meta[i]["utc_date"], reverse=True)[:max_games]
    return [kept_meta[i] for i in order], [kept_moves[i] for i in order]


# --- 2. fill missing evals -----------------------------------------------------

def _fill_evals(
    all_moves: list[list[dict]], sf_path: str | None, depth: int, min_coverage: float,
    eng: chess.engine.SimpleEngine | None = None,
) -> list[str]:
    """Mutates ``all_moves`` in place; returns each game's eval source.

    IMPORTANT: Stockfish's hash table persists for the life of one engine
    process and measurably changes search results (move ordering/pruning,
    not just speed) between "cold" and "warmed up" - two engine processes
    analysing the exact same position at the exact same depth can and do
    return different centipawn scores (verified: ~49% of plies differed
    by a meaningful margin across a same-vs-split-session comparison on
    real games). A chunked caller MUST pass one shared, already-open
    `eng` across every batch of the same request - reopening a fresh
    engine per batch silently makes evaluation, and everything downstream
    of it (wp_loss, skill sub-scores...), depend on how the request
    happened to be split into batches, not just what games it covers.
    Only opens/closes its own engine (the old, single-shot behaviour)
    when the caller doesn't supply one."""
    sources = []
    owns_engine = eng is None
    try:
        for i, moves in enumerate(all_moves):
            if not enginemod.needs_engine(moves, min_coverage):
                sources.append("lichess")
                continue
            if sf_path is None and eng is None:
                sources.append("insufficient")
                continue
            if eng is None:
                eng = chess.engine.SimpleEngine.popen_uci(sf_path)
                eng.configure({"Threads": 1, "Hash": 32})
            all_moves[i] = enginemod.fill_evals(moves, eng, depth)
            sources.append("internal_depth16")
    finally:
        if owns_engine and eng is not None:
            eng.quit()
    return sources


# --- 3. features / aggregation ------------------------------------------------

def _move_features(games_meta: list[dict], all_moves: list[list[dict]], book_max_ply: int, classify_thr: dict) -> pl.DataFrame | None:
    rows = []
    for meta, moves in zip(games_meta, all_moves):
        base, inc = parse_time_control(meta["time_control"]) or (0, 0)
        r = features_for_game(moves, inc, base, book_max_ply, classify_thr)
        if r:
            rows.extend(r)
    return pl.DataFrame(rows, schema=FEATURE_SCHEMA) if rows else None


def _aggregate_me(
    mf_df: pl.DataFrame, games_meta: list[dict]
) -> tuple[pl.DataFrame, pl.DataFrame, pl.DataFrame]:
    """Returns (my_vector_1_row, my_moves_df, my_per_game_df) — the second
    is kept for picking example positions later, the third for exposing
    real per-game move-quality (PerGameStats) instead of only the
    player-level aggregate."""
    games_df = pl.DataFrame(games_meta)
    tc = [parse_time_control(t) or (0, 0) for t in games_df["time_control"]]
    games_df = games_df.with_columns(tc_base=pl.Series([b for b, _ in tc], dtype=pl.Int32))

    lf = (
        mf_df.lazy()
        .join(games_df.lazy().select("game_id", "tc_base", "eco", "my_side"), on="game_id")
        .sort("game_id", "ply")
    )
    lf = enrich_plies(lf)
    game_lvl = game_level_agg(lf)
    mine_lf = lf.filter(pl.col("mover") == pl.col("my_side"))
    mine = mine_lf.collect()

    per_game = moves_agg(mine.lazy()).join(game_lvl, on="game_id").collect()
    meta = games_df.with_columns(
        player_elo=pl.when(pl.col("my_side") == "w").then("white_elo").otherwise("black_elo"),
        result_for_player=pl.when(pl.col("result") == "1-0")
        .then(pl.when(pl.col("my_side") == "w").then(pl.lit("win")).otherwise(pl.lit("loss")))
        .when(pl.col("result") == "0-1")
        .then(pl.when(pl.col("my_side") == "w").then(pl.lit("loss")).otherwise(pl.lit("win")))
        .otherwise(pl.lit("draw")),
    ).select("game_id", "player_elo", "result_for_player", "utc_date")

    ga = per_game.join(meta, on="game_id").with_columns(
        castle_side=pl.col("castle_san").replace_strict(_CASTLE_SIDE, default="none"),
        was_winning_after20=pl.col("max_wp_after20") >= 85,
        was_losing_after20=pl.col("min_wp_after20") <= 15,
        player_hash=pl.lit("me"),
    ).drop("castle_san")

    return aggregate_players(ga, ["player_hash"]), mine, ga


def _fill_nulls(vec: pl.DataFrame, spec: dict) -> dict[str, float]:
    elo = float(vec["player_elo"][0])
    band = str(int(elo // 100 * 100))
    band_fill = spec["elo_band_fill"].get(band, {})
    global_fill = spec["global_fill"]
    out: dict[str, float] = {}
    row = vec.to_dicts()[0]
    for f in MODELLED:
        v = row.get(f)
        if v is None or (isinstance(v, float) and math.isnan(v)):
            v = band_fill.get(f, global_fill.get(f, 0.0))
        out[f] = float(v)
    out["player_elo"] = elo
    return out


# --- 4. cohort + deviations ---------------------------------------------------

def _cohort_and_deviations(
    art: Artifacts, feat: dict, pca_vec: np.ndarray, cfg_cohort: dict
) -> tuple[pl.DataFrame, pl.DataFrame, list[dict]]:
    k = cfg_cohort["k_neighbours"]
    idx = art.neighbours(pca_vec, k)
    neigh = art.reference[idx.tolist()]

    elo = feat["player_elo"]
    peer_band = cfg_cohort["peer_band_glicko"]
    lo, hi = cfg_cohort["stronger_band_glicko"]
    peers = neigh.filter((pl.col("player_elo") - elo).abs() <= peer_band)
    betters = neigh.filter((pl.col("player_elo") - elo).is_between(lo, hi))

    deviations: list[dict] = []
    if betters.height >= 20:
        for f in MODELLED:
            vals = betters[f].drop_nulls().to_numpy().astype(float)
            if len(vals) < 10 or np.std(vals) < 1e-9:
                continue
            median = float(np.median(vals))
            mad = float(np.median(np.abs(vals - median)))
            user_val = feat[f]
            gap = _robust_z(user_val, median, mad)

            X = neigh[f].to_numpy().astype(float).reshape(-1, 1)
            y = neigh["player_elo"].to_numpy().astype(float)
            if np.std(X) < 1e-9:
                continue
            w = float(LinearRegression().fit(X, y).coef_[0])
            leverage = w * (median - user_val)
            deviations.append(
                {"feature": f, "you": user_val, "cohort": median, "gap": gap, "leverage": leverage}
            )
    return peers, betters, deviations


# --- 5. example positions (incremental top-N per feature bucket) -------------

_BUCKET_FILTER: dict[str, str] = {
    "endgame_acpl": "pl.col('phase') == 'endgame'",
    "wp_loss_endgame": "pl.col('phase') == 'endgame'",
    "wp_loss_opening": "pl.col('phase') == 'opening'",
    "wp_loss_middlegame": "pl.col('phase') == 'middlegame'",
    "tactical_gap": "pl.col('tactic')",
    "time_scramble_penalty": "pl.col('clock_frac') < 0.15",
    "choke": "pl.col('mover_wp_before') >= 60",
    "tilt": "pl.col('mover_wp_before') <= 40",
}
_EXAMPLE_COLS = ["game_id", "ply", "wp_loss", "phase", "classification"]


class _ExamplePositionAccumulator:
    """Keeps a running top-N (by wp_loss) candidate row per named bucket,
    updated one chunk at a time, instead of requiring every chunk's full
    per-move dataframe to stay in memory until the end. Each bucket only
    ever holds `n` small dict rows, so this is cheap regardless of how
    many games/chunks feed into it. `filters` is a {name: polars-expr-
    string} dict - the caller decides what a "bucket" means (the old
    cohort-feature buckets in `_BUCKET_FILTER`, or the new self-referential
    `SITUATION_BUCKETS`), so the same class serves both."""

    def __init__(self, filters: dict[str, str], n: int = 5):
        self.filters = filters
        self.n = n
        self._buckets: dict[str, list[dict]] = {key: [] for key in (*filters, "_all")}

    def add_chunk(self, mine_chunk: pl.DataFrame) -> None:
        base = mine_chunk.filter(pl.col("wp_loss").is_not_null())
        if base.height == 0:
            return
        for key, existing in self._buckets.items():
            expr = self.filters.get(key)
            bucket_df = base.filter(eval(expr, {"pl": pl})) if expr else base  # noqa: S307 — trusted, module-local
            if bucket_df.height == 0:
                continue
            candidates = bucket_df.sort("wp_loss", descending=True).head(self.n).select(_EXAMPLE_COLS).to_dicts()
            merged = sorted(existing + candidates, key=lambda r: -r["wp_loss"])[: self.n]
            self._buckets[key] = merged

    def top(self, feature: str, n: int) -> list[dict]:
        rows = self._buckets.get(feature) or self._buckets["_all"]
        return rows[:n]


_SITUATION_LABELS: dict[str, str] = {
    "calm": "Calm, unforced positions",
    "tactical": "Tactical positions",
    "calculation": "Complex, calculation-heavy positions",
    "time_pressure": "Low on the clock",
    "opening_transition": "Just out of known theory",
    "defending": "Defending a worse position",
}
# Below this many of a player's own moves in a bucket, its average wp_loss
# is too noisy to rank or show - matches the ">= 10"/">= 20" sample-size
# guards already used elsewhere in this file (peer cohort, sub-score
# percentile) for the same reason: small samples, not systematic signal.
_MIN_SITUATION_MOVES = 15


class _SituationAccumulator:
    """Running (sum(wp_loss), count) per SITUATION_BUCKETS key, across
    chunks - the self-referential twin of _ExamplePositionAccumulator's
    example rows. No population/reference data involved: every number
    here comes only from this one player's own analyzed moves, scored only
    against Stockfish's own best move (wp_loss itself)."""

    def __init__(self) -> None:
        self._sum: dict[str, float] = dict.fromkeys(SITUATION_BUCKETS, 0.0)
        self._count: dict[str, int] = dict.fromkeys(SITUATION_BUCKETS, 0)
        self.total_moves = 0

    def add_chunk(self, mine_chunk: pl.DataFrame) -> None:
        base = mine_chunk.filter(pl.col("wp_loss").is_not_null())
        if base.height == 0:
            return
        self.total_moves += base.height
        for key, expr in SITUATION_BUCKETS.items():
            bucket_df = base.filter(eval(expr, {"pl": pl}))  # noqa: S307 — trusted, module-local
            if bucket_df.height == 0:
                continue
            self._sum[key] += float(bucket_df["wp_loss"].sum())
            self._count[key] += bucket_df.height

    def gaps(self) -> list[dict]:
        """One row per bucket with enough moves: your_wp_loss (mean),
        share_of_moves (of all analyzed moves), impact (their product -
        how much of this player's total lost win-probability this
        situation accounts for)."""
        out = []
        if self.total_moves == 0:
            return out
        for key, count in self._count.items():
            if count < _MIN_SITUATION_MOVES:
                continue
            your_wp_loss = self._sum[key] / count
            share = count / self.total_moves
            out.append(
                {
                    "id": key, "label": _SITUATION_LABELS[key],
                    "your_wp_loss": your_wp_loss, "share_of_moves": share,
                    "impact": your_wp_loss * share,
                }
            )
        return out


def _example_positions_from_rows(rows: list[dict], moves_by_game: dict[str, list[dict]]) -> list[ExamplePosition]:
    out = []
    for row in rows:
        moves = moves_by_game.get(row["game_id"])
        if not moves:
            continue
        board = chess.Board()
        for m in moves[: row["ply"] - 1]:
            board.push(chess.Move.from_uci(m["uci"]))
        out.append(
            ExamplePosition(
                game_id=row["game_id"], ply=row["ply"], fen=board.fen(),
                wp_loss=round(row["wp_loss"], 1),
                seed=f"{row['phase']} position, {row['classification']}",
            )
        )
    return out


MAX_MOVE_NUMBER = 40  # moves at/after this are folded into one final bucket


def _complexity_by_move(mine: pl.DataFrame, min_per_bucket: int = 5) -> list[ComplexityByMoveBucket]:
    """Average position complexity at each move number, across all of your
    analyzed games - the "arc" of a typical game, showing where it turns
    from known/quiet opening play to real fighting chess. `mine` only
    needs to carry complexity_pred + ply - the accumulated slim frame
    across chunks, not the full per-move dataframe."""
    rows = mine.filter(pl.col("complexity_pred").is_not_null() & pl.col("ply").is_not_null())
    if rows.height == 0:
        return []
    bucketed = rows.with_columns(
        move_number=((pl.col("ply") + 1) // 2).clip(1, MAX_MOVE_NUMBER)
    )
    curve = (
        bucketed.group_by("move_number")
        .agg(
            pl.col("complexity_pred").mean().alias("mean_complexity"),
            pl.len().alias("n"),
        )
        .filter(pl.col("n") >= min_per_bucket)
        .sort("move_number")
    )
    return [
        ComplexityByMoveBucket(
            move_number=int(row["move_number"]), mean_complexity=round(row["mean_complexity"], 1), n=row["n"],
        )
        for row in curve.iter_rows(named=True)
    ]


# Real per-move-number style trajectory - the columns needed to recompute
# 9 of the 16 STYLE features (pipeline/common/features.py) within a move-
# number sub-range, mirroring gameagg.moves_agg's exact per-feature filter
# logic. The other 7 STYLE features (castled_ply_mean, never_castled_rate,
# castle_queenside_rate, queen_dev_ply_mean, first_dev_ply_mean,
# book_exit_ply_mean, repertoire_entropy) are single whole-game events -
# "which ply did I castle," not a per-move rate - so they aren't
# recomputable per bin and stay fixed at the player's overall value.
TRAJECTORY_BIN_WIDTH = 5
# Same noise floor as _MIN_SITUATION_MOVES - these are per-ply rates over
# a much narrower slice (one 5-move bin) than the situational buckets, so
# a bin without enough of its own moves falls back to the overall value
# per-feature rather than showing a number built on a handful of moves.
_MIN_TRAJECTORY_MOVES = 20
_MIN_TRAJECTORY_SUBFILTER_MOVES = 10  # toward_king_rate/tension_release_rate have their own narrower denominator

_TRAJECTORY_COLUMNS = [
    "ply", "is_check", "is_capture", "king_dist_delta", "piece_moved", "phase",
    "see", "released_tension", "pawn_tension_before", "think_time_s",
    "wp_white_after", "material_swing",
]


def _style_trajectory(
    trajectory_accum: pl.DataFrame, feat: dict, skill_score: float, art: Artifacts,
) -> list[StyleTrajectoryPoint]:
    """This player's real style vector (all 5 PCA components, same order
    as style.vector), computed separately per move-number bin instead of
    once for the whole game - the actual shape of how their style changes
    across a typical game, not a hand-picked illustration. Every number
    comes from this player's own moves only, re-bucketed by when in the
    game they happened, run through the same fixed style_pca transform
    used for the single overall vector - no reference population involved
    anywhere in this function.

    `eval_volatility_mean`/`material_swing_mean` here use only this
    player's own moves in the bin - the pipeline's whole-game definition
    of these two pools both colours' plies (gameagg.game_level_agg, run
    on the unfiltered frame), which this player's own moves alone can't
    reconstruct. A real approximation of the whole-game feature of the
    same name ("volatility/swing around your own moves in this stretch"),
    not a bug - see the caveat this adds in _finalize_profile.
    """
    if trajectory_accum.height == 0:
        return []

    binned = trajectory_accum.with_columns(
        move_number=((pl.col("ply") + 1) // 2).clip(1, MAX_MOVE_NUMBER),
    ).with_columns(
        bin=(pl.col("move_number") - 1) // TRAJECTORY_BIN_WIDTH * TRAJECTORY_BIN_WIDTH + 1,
    )

    grouped = (
        binned.group_by("bin")
        .agg(
            pl.len().alias("n"),
            pl.col("is_check").mean().alias("check_rate"),
            pl.col("is_capture").mean().alias("capture_rate"),
            (pl.col("king_dist_delta") > 0)
            .filter((pl.col("piece_moved") != "p") & (pl.col("phase") == "middlegame"))
            .mean()
            .alias("toward_king_rate"),
            ((pl.col("piece_moved") != "p") & (pl.col("phase") == "middlegame")).sum().alias("_toward_king_n"),
            (pl.col("see") <= -1.0).mean().alias("sac_rate"),
            pl.col("released_tension").filter(pl.col("pawn_tension_before") > 0).mean().alias("tension_release_rate"),
            (pl.col("pawn_tension_before") > 0).sum().alias("_tension_n"),
            (pl.col("piece_moved") == "p").mean().alias("pawn_move_rate"),
            pl.col("think_time_s").mean().alias("mean_think_time"),
            pl.col("wp_white_after").std().alias("eval_volatility_mean"),
            pl.col("material_swing").mean().alias("material_swing_mean"),
        )
        .filter(pl.col("n") >= _MIN_TRAJECTORY_MOVES)
        .sort("bin")
    )

    points = []
    for row in grouped.iter_rows(named=True):
        feat_bin = dict(feat)
        for name in (
            "check_rate", "capture_rate", "sac_rate", "pawn_move_rate",
            "mean_think_time", "eval_volatility_mean", "material_swing_mean",
        ):
            v = row[name]
            if v is not None:
                feat_bin[name] = float(v)
        if row["toward_king_rate"] is not None and row["_toward_king_n"] >= _MIN_TRAJECTORY_SUBFILTER_MOVES:
            feat_bin["toward_king_rate"] = float(row["toward_king_rate"])
        if row["tension_release_rate"] is not None and row["_tension_n"] >= _MIN_TRAJECTORY_SUBFILTER_MOVES:
            feat_bin["tension_release_rate"] = float(row["tension_release_rate"])

        pca_vec = art.style_pca(feat_bin, skill_score)
        points.append(
            StyleTrajectoryPoint(
                move_number=int(row["bin"]), n=row["n"],
                vector=[round(float(v), 3) for v in pca_vec],
            )
        )
    return points


# --- 6. per-chunk processing --------------------------------------------------

def _process_chunk(
    games_meta: list[dict], all_moves: list[list[dict]], cfg: dict, art: Artifacts
) -> tuple[pl.DataFrame, pl.DataFrame] | None:
    """Move features + book tags + feature-model scoring + per-game
    aggregation for one batch of already eval-filled games. Returns
    (ga_chunk, mine_chunk) - the caller keeps ga_chunk (cheap, one row per
    game) and the two columns it needs from mine_chunk, then drops the
    rest. None if this batch had no usable moves at all (a bad/short
    batch shouldn't fail the whole request - see build_profile_chunks)."""
    mf_cfg = cfg["move_features"]
    mf_df = _move_features(games_meta, all_moves, mf_cfg["book_max_ply"], mf_cfg["classify"])
    if mf_df is None:
        return None
    mf_df = apply_book_tags(mf_df, art.book_set)
    if art.feature_models is not None:
        mf_df = score_features(mf_df, art.feature_models)
    else:  # test fixtures without a trained feature-model layer
        mf_df = mf_df.with_columns(
            has_tactic_pred=pl.lit(0.0).cast(pl.Float32),
            only_move_pred=pl.lit(0.0).cast(pl.Float32),
            complexity_pred=pl.lit(0.0).cast(pl.Float32),
            wp_loss_model=pl.col("wp_loss"),
        )
    _vec_chunk, mine_chunk, ga_chunk = _aggregate_me(mf_df, games_meta)
    return ga_chunk, mine_chunk


# --- 7. finalize: everything downstream of the accumulated per-game rows ----

def _situational_gaps(
    situation_acc: "_SituationAccumulator",
    situation_example_acc: _ExamplePositionAccumulator,
    moves_by_game: dict[str, list[dict]],
    your_overall_wp_loss: float,
) -> tuple[list[SituationalGap], list[SituationalGap]]:
    """(critical_lessons, strong_situations) - self-referential, no
    population involved: `impact` ranks by how much of this player's own
    total lost win-probability a situation accounts for (critical_lessons,
    top 3). strong_situations is NOT just "whatever's left over" - a
    situation only counts as a strength if its own wp_loss is at or below
    this player's own overall average (`your_overall_wp_loss`); a
    situation that's actually worse than their average, but simply rare
    enough to miss the impact cutoff, is not a strength just because it
    isn't a critical lesson either. Mutually exclusive either way - the
    same situation never appears in both lists."""
    gaps = situation_acc.gaps()
    if not gaps:
        return [], []

    def to_gap(g: dict, with_examples: bool) -> SituationalGap:
        examples = (
            _example_positions_from_rows(situation_example_acc.top(g["id"], 2), moves_by_game)
            if with_examples else []
        )
        return SituationalGap(
            id=g["id"], label=g["label"], your_wp_loss=round(g["your_wp_loss"], 2),
            share_of_moves=round(g["share_of_moves"], 3), impact=round(g["impact"], 3),
            example_positions=examples,
        )

    by_impact = sorted(gaps, key=lambda g: -g["impact"])
    lessons = [to_gap(g, with_examples=True) for g in by_impact[:3]]
    lesson_ids = {g["id"] for g in by_impact[:3]}
    candidates = [
        g for g in gaps if g["id"] not in lesson_ids and g["your_wp_loss"] <= your_overall_wp_loss
    ]
    strong = [to_gap(g, with_examples=False) for g in sorted(candidates, key=lambda g: g["your_wp_loss"])[:3]]
    return lessons, strong


def _finalize_profile(
    *,
    ga_accum: pl.DataFrame,
    complexity_accum: pl.DataFrame,
    trajectory_accum: pl.DataFrame,
    example_acc: _ExamplePositionAccumulator,
    situation_acc: "_SituationAccumulator",
    situation_example_acc: _ExamplePositionAccumulator,
    moves_by_game: dict[str, list[dict]],
    games_meta_all: list[dict],
    sources_all: list[str],
    username: str,
    time_class: str,
    reference_speed: str,
    provider: str,
    art: Artifacts,
    cfg: dict,
) -> Profile:
    """Everything that only ever needed the small accumulated state, not
    any single chunk's wide per-move dataframe - style projection,
    situational-gap ranking, phase accuracy, and the complexity curve.
    Called after every chunk (on whatever has accumulated so far) to
    produce a partial snapshot, and once more at the end for the final one
    - same function either way.

    Nothing here compares against a peer/reference population - style is a
    fixed pre-fitted transform applied to this player's own features
    (`art.style_pca`, no live population lookup), and critical_lessons/
    strong_situations are ranked purely against Stockfish's own evaluation
    of this player's own moves. That means this function no longer
    branches on `provider`: the same computation applies to every source.
    skill/cohort/focus_areas/strengths/style.signature are peer-comparison
    concepts that need a real reference population - not deleted (kept as
    valid, empty/zero schema fields) so they can be reintroduced later,
    just not computed here today."""
    vec = aggregate_players(ga_accum, ["player_hash"])
    feat = _fill_nulls(vec, art.spec)
    complexity_by_move = _complexity_by_move(complexity_accum)

    per_game_stats = [
        PerGameStats(
            game_id=row["game_id"],
            date=row["utc_date"],
            result=row["result_for_player"],
            mean_wp_loss=round(row["mean_wp_loss"], 2),
            blunder_rate=round(row["blunder_rate"], 3),
            mistake_rate=round(row["mistake_rate"], 3),
            wp_loss_opening=round(row["wp_loss_opening"], 2) if row["wp_loss_opening"] is not None else None,
            wp_loss_middlegame=round(row["wp_loss_middlegame"], 2) if row["wp_loss_middlegame"] is not None else None,
            wp_loss_endgame=round(row["wp_loss_endgame"], 2) if row["wp_loss_endgame"] is not None else None,
        )
        for row in ga_accum.iter_rows(named=True)
        if row["mean_wp_loss"] is not None and row["blunder_rate"] is not None
    ]

    # Style: a fixed transform (scaler + PCA + skill-residualization
    # coefficients, all fitted once and baked into the artifacts) applied
    # to this player's own aggregated features - never touches the
    # reference population at request time. `skill["overall"]` is needed
    # internally only to residualize style away from skill; not exposed.
    skill = art.skill(feat)
    pca_vec = art.style_pca(feat, skill["overall"])
    xy = art.umap_xy(pca_vec)
    axes = [
        StyleAxis(id=f"pc{i}", label=art.spec["pc_axis_labels"][i], value=round(float(pca_vec[i]), 2))
        for i in range(min(art.spec.get("n_identity_axes", 4), len(pca_vec)))
    ]

    critical_lessons, strong_situations = _situational_gaps(
        situation_acc, situation_example_acc, moves_by_game, your_overall_wp_loss=feat["mean_wp_loss"]
    )
    style_trajectory = _style_trajectory(trajectory_accum, feat, skill["overall"], art)

    # phase accuracy — each phase's own wp_loss vs. this player's overall
    # average across all phases (not a peer median - no population
    # involved). Unconditional: `feat` is always filled (elo-band/global
    # medians), so every phase always has a value, pairing with the
    # dashboard's phase move-share chart regardless of anything else.
    phase_accuracy: dict[str, PhaseAccuracy] = {
        phase: PhaseAccuracy(you=round(feat[key], 2), your_overall=round(feat["mean_wp_loss"], 2))
        for phase, key in (
            ("opening", "wp_loss_opening"),
            ("middlegame", "wp_loss_middlegame"),
            ("endgame", "wp_loss_endgame"),
        )
    }

    dates = [g["utc_date"] for g in games_meta_all if g["utc_date"]]
    eval_sources = set(sources_all)
    caveats = [f"Based on {len(games_meta_all)} {time_class} games" + (f" from {provider}." if provider != "lichess" else ".")]
    if reference_speed != time_class:
        caveats.append(
            f"No {time_class} reference population exists yet, so style axes are computed using a model "
            f"calibrated on {reference_speed} players instead - exact positioning may be slightly off. "
            f"Critical lessons and per-game charts are unaffected: those come only from your own moves, "
            f"scored only against Stockfish, no population involved."
        )
    elif provider != "lichess":
        caveats.append(
            f"Style axes are computed using a model calibrated on Lichess players, so exact positioning may "
            f"be slightly off for {provider} games. Critical lessons and per-game charts are unaffected: "
            f"those come only from your own moves, scored only against Stockfish, no population involved."
        )
    if len(eval_sources) > 1:
        caveats.append("Some games were analysed locally (no pre-existing evaluation).")
    if style_trajectory:
        caveats.append(
            "The style trajectory's volatility/material-swing components use only your own moves in each "
            "stretch, not the whole-game (both-colours) definition used for the overall style axes above."
        )

    top_lesson = critical_lessons[0].label.lower() if critical_lessons else "no clear recurring pattern yet"
    coach_context = f"{len(games_meta_all)} {time_class} games analyzed; biggest lever: {top_lesson}"

    return Profile(
        computed_at=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        source=Source(
            provider=provider, username=username, games_analyzed=len(games_meta_all), time_class=time_class,
            date_range=(min(dates), max(dates)) if dates else None,
            eval_source="mixed" if len(eval_sources) > 1 else next(iter(eval_sources), provider),
        ),
        skill=Skill(overall=0, confidence=0, sub={}),
        style=Style(vector=[round(float(v), 3) for v in pca_vec], umap_xy=xy, axes=axes, signature=[]),
        cohort=Cohort(size=0, your_band=(0.0, 0.0), stronger_band=(0.0, 0.0)),
        focus_areas=[],
        strengths=[],
        critical_lessons=critical_lessons,
        strong_situations=strong_situations,
        style_trajectory=style_trajectory,
        phase_accuracy=phase_accuracy,
        per_game=per_game_stats,
        complexity_by_move=complexity_by_move,
        coach_context=coach_context,
        caveats=caveats,
    )


# --- entry points --------------------------------------------------------------

def build_profile_chunks(
    pgn_text: str, username: str, time_class: str, art: Artifacts, cfg: dict,
    batch_size: int = DEFAULT_BATCH_SIZE, max_snapshots: int = 40,
    reference_speed: str | None = None, provider: str = "lichess",
) -> Iterator[tuple[int, int, Profile | None]]:
    """Same computation as build_profile, but yields (games_processed,
    games_total, profile) after every batch instead of returning once at
    the end. `profile` is None for a batch that didn't yet produce enough
    accumulated games for a snapshot, or that fell between snapshots -
    callers that just want the final result can skip Nones and take the
    last non-None profile, which is exactly what build_profile does.

    Memory stays bounded in game count: only the per-game aggregate rows
    (`ga`, ~50 scalar columns but one row per game), a 2-column complexity/
    ply frame, a handful of example-position candidates per feature, and
    each game's own move list are kept across batches. The wide, scored
    per-move dataframe - the actual heavy structure, dozens of float
    columns per ply - is built and discarded one batch at a time.

    Snapshotting (calling _finalize_profile - skill/style projection,
    cohort neighbour search, deviation scan over ~30 features) is real
    work, independent of batch_size, so it isn't done every batch once a
    request gets large: the stride between snapshots grows with
    games_total, capped at `max_snapshots` total snapshots for the whole
    job regardless of how many games it covers. At today's scale
    (hundreds of games) this still means a snapshot every batch; a
    30,000-game request gets ~40 evenly-spaced snapshots instead of
    1,200 expensive ones. The last batch always snapshots, so the job
    still ends with a real, complete final profile either way.
    """
    ing = cfg["ingest"]
    el_cfg = cfg["engine_labels"]
    pv_cfg = cfg["player_vectors"]
    # Which speed `art`'s reference population actually represents - the
    # caller (the service, which decides which Artifacts to load for this
    # request) may pass this explicitly when it had to fall back to a
    # different population than the one requested; defaulting to
    # time_class means "no mismatch" for any caller that doesn't care
    # (single-population tests, the old single-shot behaviour).
    reference_speed = reference_speed or time_class

    games_meta, all_moves = _parse_games(pgn_text, time_class, ing["min_plies"])
    games_meta, all_moves = _select_my_recent_games(
        games_meta, all_moves, username, cfg["service"]["max_games_per_request"]
    )
    if len(games_meta) < pv_cfg["min_games"]:
        raise NotEnoughGames(
            f"only {len(games_meta)} usable {time_class} games — need at least {pv_cfg['min_games']}"
        )

    sf_path = cfg["paths"]["stockfish"]
    sf_path_str = str(sf_path) if sf_path.exists() else None
    games_total = len(games_meta)
    snapshot_stride = max(batch_size, -(-games_total // max_snapshots))  # ceil div

    ga_accum: pl.DataFrame | None = None
    complexity_accum: pl.DataFrame | None = None
    trajectory_accum: pl.DataFrame | None = None
    example_acc = _ExamplePositionAccumulator(_BUCKET_FILTER)
    situation_example_acc = _ExamplePositionAccumulator(SITUATION_BUCKETS)
    situation_acc = _SituationAccumulator()
    moves_by_game: dict[str, list[dict]] = {}
    games_meta_all: list[dict] = []
    sources_all: list[str] = []
    games_since_snapshot = 0

    # One engine, shared across every batch of this request - not one per
    # batch. Stockfish's hash table persists for an engine process's whole
    # life and measurably changes search results between a cold and a
    # warmed-up table, so reopening a fresh engine per batch would make a
    # game's own evaluation - and everything downstream of it - depend on
    # which batch it landed in, not just what game it is. This is the
    # same one-engine-per-request behaviour the old single-shot path
    # always had; chunking games must never mean chunking the engine too.
    eng: chess.engine.SimpleEngine | None = None
    if sf_path_str is not None:
        eng = chess.engine.SimpleEngine.popen_uci(sf_path_str)
        eng.configure({"Threads": 1, "Hash": 32})

    try:
        for start in range(0, games_total, batch_size):
            meta_batch = games_meta[start : start + batch_size]
            moves_batch = all_moves[start : start + batch_size]
            is_last_batch = start + batch_size >= games_total

            sources_batch = _fill_evals(
                moves_batch, sf_path_str, el_cfg["depth"], ing["min_eval_coverage"], eng=eng
            )
            ok = [i for i, s in enumerate(sources_batch) if s != "insufficient"]
            meta_batch = [meta_batch[i] for i in ok]
            moves_batch = [moves_batch[i] for i in ok]
            sources_batch = [sources_batch[i] for i in ok]

            if meta_batch:
                moves_by_game.update({m["game_id"]: mv for m, mv in zip(meta_batch, moves_batch)})
                games_meta_all.extend(meta_batch)
                sources_all.extend(sources_batch)
                games_since_snapshot += len(meta_batch)

                chunk = _process_chunk(meta_batch, moves_batch, cfg, art)
                if chunk is not None:
                    ga_chunk, mine_chunk = chunk
                    ga_accum = ga_chunk if ga_accum is None else pl.concat([ga_accum, ga_chunk])
                    slim = mine_chunk.select("complexity_pred", "ply")
                    complexity_accum = slim if complexity_accum is None else pl.concat([complexity_accum, slim])
                    traj_slim = mine_chunk.select(_TRAJECTORY_COLUMNS)
                    trajectory_accum = traj_slim if trajectory_accum is None else pl.concat([trajectory_accum, traj_slim])
                    example_acc.add_chunk(mine_chunk)
                    situation_example_acc.add_chunk(mine_chunk)
                    situation_acc.add_chunk(mine_chunk)
                    del mine_chunk  # the wide per-move frame - drop before the next batch

            games_processed = len(games_meta_all)
            should_snapshot = is_last_batch or games_since_snapshot >= snapshot_stride
            if ga_accum is None or ga_accum.height < pv_cfg["min_games"] or not should_snapshot:
                yield games_processed, games_total, None
                continue

            games_since_snapshot = 0
            profile = _finalize_profile(
                ga_accum=ga_accum, complexity_accum=complexity_accum, trajectory_accum=trajectory_accum,
                example_acc=example_acc,
                situation_acc=situation_acc, situation_example_acc=situation_example_acc,
                moves_by_game=moves_by_game, games_meta_all=games_meta_all, sources_all=sources_all,
                username=username, time_class=time_class, reference_speed=reference_speed,
                provider=provider, art=art, cfg=cfg,
            )
            yield games_processed, games_total, profile
    finally:
        if eng is not None:
            eng.quit()

    if ga_accum is None or ga_accum.height < pv_cfg["min_games"]:
        raise NotEnoughGames("too few usable games after evaluation/move filtering")


def build_profile(
    pgn_text: str, username: str, time_class: str, art: Artifacts, cfg: dict,
    batch_size: int = DEFAULT_BATCH_SIZE, reference_speed: str | None = None, provider: str = "lichess",
) -> Profile:
    """Single-shot convenience wrapper over build_profile_chunks, for
    callers (existing tests, anything not showing progress) that just
    want the final result."""
    last: Profile | None = None
    for _processed, _total, profile in build_profile_chunks(
        pgn_text, username, time_class, art, cfg, batch_size=batch_size,
        reference_speed=reference_speed, provider=provider,
    ):
        if profile is not None:
            last = profile
    if last is None:
        raise NotEnoughGames("no usable games produced a profile")
    return last
