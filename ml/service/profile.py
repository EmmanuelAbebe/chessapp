"""Builds one user's profile: parse their PGN, compute features exactly the
way the reference population was computed, project into the style/skill
space, and compare against a stronger style-neighbourhood cohort.

The heavy lifting — per-ply features, book tagging, feature-model scoring,
per-game/per-player aggregation, and the skill/style projection — all comes
from ``pipeline/common/*``, unchanged from what built the reference set.
This module is the glue: PGN in, ``schemas.Profile`` out.
"""

from __future__ import annotations

import io
import math
import time

import chess
import chess.engine
import numpy as np
import polars as pl
from sklearn.linear_model import LinearRegression

from pipeline.common import pgn as pgnmod
from pipeline.common.featuremodels import score as score_features
from pipeline.common.features import LOWER_IS_BETTER, MODELLED, SKILL_SUBSCORES, TRAITS
from pipeline.common.filters import parse_time_control, speed_bucket
from pipeline.common.gameagg import enrich_plies, game_level_agg, moves_agg
from pipeline.common.movefeatures import FEATURE_SCHEMA, apply_book_tags, features_for_game
from pipeline.common.playeragg import aggregate_players
from pipeline.common.project import Artifacts
from service.labels import label_for
from service import engine as enginemod
from service.schemas import (
    Coaching, Cohort, Evidence, ExamplePosition, FocusArea, PhaseAccuracy, Profile,
    SignatureItem, Skill, Source, Strength, Style, StyleAxis, SubScore,
)

_VALID_RESULTS = {"1-0", "0-1", "1/2-1/2"}
_CASTLE_SIDE = {"O-O": "k", "O-O-O": "q"}


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
    all_moves: list[list[dict]], sf_path: str | None, depth: int, min_coverage: float
) -> list[str]:
    """Mutates ``all_moves`` in place; returns each game's eval source."""
    sources = []
    eng: chess.engine.SimpleEngine | None = None
    try:
        for i, moves in enumerate(all_moves):
            if not enginemod.needs_engine(moves, min_coverage):
                sources.append("lichess")
                continue
            if sf_path is None:
                sources.append("insufficient")
                continue
            if eng is None:
                eng = chess.engine.SimpleEngine.popen_uci(sf_path)
                eng.configure({"Threads": 1, "Hash": 32})
            all_moves[i] = enginemod.fill_evals(moves, eng, depth)
            sources.append("internal_depth16")
    finally:
        if eng is not None:
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


def _aggregate_me(mf_df: pl.DataFrame, games_meta: list[dict]) -> tuple[pl.DataFrame, pl.DataFrame]:
    """Returns (my_vector_1_row, my_moves_df) — the second is kept for
    picking example positions later."""
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

    return aggregate_players(ga, ["player_hash"]), mine


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


def _example_positions(feature: str, mine: pl.DataFrame, moves_by_game: dict[str, list[dict]], n: int = 2) -> list[ExamplePosition]:
    expr = _BUCKET_FILTER.get(feature)
    bucket = mine.filter(eval(expr, {"pl": pl})) if expr else mine  # noqa: S307 — trusted, module-local
    bucket = bucket.filter(pl.col("wp_loss").is_not_null())
    if bucket.height == 0:
        bucket = mine.filter(pl.col("wp_loss").is_not_null())
    top = bucket.sort("wp_loss", descending=True).head(n)
    out = []
    for row in top.iter_rows(named=True):
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


# --- entry point ---------------------------------------------------------------

def build_profile(pgn_text: str, username: str, time_class: str, art: Artifacts, cfg: dict) -> Profile:
    ing = cfg["ingest"]
    mf_cfg = cfg["move_features"]
    el_cfg = cfg["engine_labels"]
    pv_cfg = cfg["player_vectors"]

    games_meta, all_moves = _parse_games(pgn_text, time_class, ing["min_plies"])
    games_meta, all_moves = _select_my_recent_games(
        games_meta, all_moves, username, pv_cfg["max_games_per_player"]
    )
    if len(games_meta) < pv_cfg["min_games"]:
        raise NotEnoughGames(
            f"only {len(games_meta)} usable {time_class} games — need at least {pv_cfg['min_games']}"
        )

    sf_path = cfg["paths"]["stockfish"]
    sources = _fill_evals(
        all_moves, str(sf_path) if sf_path.exists() else None,
        el_cfg["depth"], ing["min_eval_coverage"],
    )
    ok = [i for i, s in enumerate(sources) if s != "insufficient"]
    games_meta = [games_meta[i] for i in ok]
    all_moves = [all_moves[i] for i in ok]
    sources = [sources[i] for i in ok]
    if len(games_meta) < pv_cfg["min_games"]:
        raise NotEnoughGames("too many games lack evaluation data (no engine configured)")

    moves_by_game = {m["game_id"]: mv for m, mv in zip(games_meta, all_moves)}

    mf_df = _move_features(games_meta, all_moves, mf_cfg["book_max_ply"], mf_cfg["classify"])
    if mf_df is None:
        raise NotEnoughGames("no usable moves after filtering")
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

    vec, mine = _aggregate_me(mf_df, games_meta)
    feat = _fill_nulls(vec, art.spec)

    skill = art.skill(feat)
    pca_vec = art.style_pca(feat, skill["overall"])
    xy = art.umap_xy(pca_vec)
    peers, betters, deviations = _cohort_and_deviations(art, feat, pca_vec, cfg["cohort"])

    confidence = min(1.0, len(games_meta) / 50.0)

    # sub-score percentile within your rating band (not style-filtered —
    # a plain "how does this sub-score compare to players near your Elo"
    # read, independent of the style-neighbourhood cohort used elsewhere).
    band_pop = art.reference.filter(
        (pl.col("player_elo") - feat["player_elo"]).abs() <= cfg["cohort"]["peer_band_glicko"]
    )
    sub_pct: dict[str, float] = {}
    if band_pop.height >= 10:
        for name in SKILL_SUBSCORES:
            vals = band_pop[f"skill_{name}"].drop_nulls().to_numpy().astype(float)
            if len(vals) >= 10:
                sub_pct[name] = round(float((vals < skill[name]).mean() * 100), 1)

    # focus areas — improvement leverage vs stronger style-neighbours
    positive = sorted(
        (d for d in deviations if d["leverage"] > 2.0 and abs(d["gap"]) >= 1.0),
        key=lambda d: -d["leverage"],
    )[:5]
    focus_conf = "high" if betters.height >= 150 else "medium" if betters.height >= 40 else "low"
    def _focus_z(d: dict) -> tuple[float, bool]:
        lower_better = LOWER_IS_BETTER.get(d["feature"])
        if lower_better is None:
            return d["gap"], False  # style feature - no known good/bad direction
        return (-d["gap"] if lower_better else d["gap"]), True

    focus_areas = []
    for i, d in enumerate(positive):
        z, graded = _focus_z(d)
        focus_areas.append(
            FocusArea(
                id=d["feature"], rank=i + 1, title=label_for(d["feature"]),
                evidence=[Evidence(feature=d["feature"], label=label_for(d["feature"]), you=round(d["you"], 2), cohort=round(d["cohort"], 2))],
                estimated_rating_gain=round(d["leverage"], 0), confidence=focus_conf,
                example_positions=_example_positions(d["feature"], mine, moves_by_game),
                z=round(z, 2), graded=graded,
            )
        )

    # strengths — favourable vs same-skill peers, on skill features with a known direction.
    # Threshold is deliberately looser than focus areas (0.75 MAD vs 1.0): with peer cohorts
    # this small (~20-150 players), a strict bar leaves strengths empty far more often than
    # it should — most players clear a lower bar on at least a couple of skill features.
    # Capped at 5, same as focus areas, so a player who qualifies for several isn't
    # truncated to 3 while focus areas show all 5 - that was a structural bias toward
    # red (focus areas compare you to *stronger* players - almost everyone has gaps
    # there - while strengths compare you to same-skill peers, a fairer, harder bar).
    strength_rows = []
    if peers.height >= 20:
        for f, lower_better in LOWER_IS_BETTER.items():
            vals = peers[f].drop_nulls().to_numpy().astype(float)
            if len(vals) < 10:
                continue
            median = float(np.median(vals))
            mad = float(np.median(np.abs(vals - median)))
            raw = _robust_z(feat[f], median, mad)
            z = -raw if lower_better else raw
            if z >= 0.75:
                strength_rows.append((f, z, feat[f], median))
    strength_rows.sort(key=lambda r: -r[1])
    strengths = [
        Strength(
            id=f, title=label_for(f),
            evidence=[Evidence(feature=f, label=label_for(f), you=round(you, 2), cohort=round(cohort, 2))],
            text=f"You're stronger than {min(99, int(50 + z * 15))}% of players with your style on this.",
            z=round(z, 2),
        )
        for f, z, you, cohort in strength_rows[:5]
    ]

    # signature — biggest deviations from same-skill peers, any feature (style-flavoured framing)
    signature = []
    if peers.height >= 20:
        sig_rows = []
        for f in MODELLED:
            vals = peers[f].drop_nulls().to_numpy().astype(float)
            if len(vals) < 10 or np.std(vals) < 1e-9:
                continue
            median = float(np.median(vals))
            mad = float(np.median(np.abs(vals - median)))
            z = _robust_z(feat[f], median, mad)
            sig_rows.append((f, z))
        sig_rows.sort(key=lambda r: -abs(r[1]))
        for f, z in sig_rows[:3]:
            signature.append(
                SignatureItem(
                    feature=f, you=round(feat[f], 2),
                    peers=round(float(np.median(peers[f].drop_nulls())), 2), z=round(z, 2),
                    text=f"Your {label_for(f).lower()} stands out from players at your level.",
                )
            )

    axes = [
        StyleAxis(id=f"pc{i}", label=art.spec["pc_axis_labels"][i], value=round(float(pca_vec[i]), 2))
        for i in range(min(4, len(pca_vec)))
    ]

    # phase accuracy — you vs. same-skill peers' median wp_loss (lower is
    # better) in each phase. Unconditional, unlike strengths/focus_areas/
    # signature: the dashboard pairs this against its own notation-only
    # phase move-share chart, so it needs a value for every phase that has
    # peer data, not just the ones that happen to clear a deviation bar.
    phase_accuracy: dict[str, PhaseAccuracy] = {}
    if peers.height >= 20:
        for phase, key in (
            ("opening", "wp_loss_opening"),
            ("middlegame", "wp_loss_middlegame"),
            ("endgame", "wp_loss_endgame"),
        ):
            vals = peers[key].drop_nulls().to_numpy().astype(float)
            if len(vals) >= 10:
                phase_accuracy[phase] = PhaseAccuracy(
                    you=round(feat[key], 2), peers=round(float(np.median(vals)), 2)
                )

    dates = [g["utc_date"] for g in games_meta if g["utc_date"]]
    eval_sources = set(sources)
    caveats = [f"Based on {len(games_meta)} {time_class} games."]
    if betters.height < 40:
        caveats.append("Not many stronger players share your style yet — focus areas are lower-confidence.")
    if peers.height >= 20 and len(strengths) < 2:
        caveats.append("Your peer cohort is still small, so only your clearest strengths show up here — more games (yours and the reference pool's) will surface more.")
    if len(eval_sources) > 1:
        caveats.append("Some games were analysed locally (no pre-existing evaluation).")

    top_focus = ", ".join(f.title.lower() for f in focus_areas[:2]) or "no clear recurring pattern yet"
    coach_context = (
        f"rated ~{int(feat['player_elo'])} {time_class}; recurring: {top_focus}"
    )

    return Profile(
        computed_at=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        source=Source(
            username=username, games_analyzed=len(games_meta), time_class=time_class,
            date_range=(min(dates), max(dates)) if dates else None,
            eval_source="mixed" if len(eval_sources) > 1 else next(iter(eval_sources), "lichess"),
        ),
        skill=Skill(
            overall=round(skill["overall"], 0), confidence=round(confidence, 2),
            sub={
                k: SubScore(score=round(v, 0), pct_in_band=sub_pct.get(k))
                for k, v in skill.items() if k != "overall"
            },
        ),
        style=Style(vector=[round(float(v), 3) for v in pca_vec], umap_xy=xy, axes=axes, signature=signature),
        cohort=Cohort(
            size=betters.height,
            your_band=(feat["player_elo"] - cfg["cohort"]["peer_band_glicko"], feat["player_elo"] + cfg["cohort"]["peer_band_glicko"]),
            stronger_band=(feat["player_elo"] + cfg["cohort"]["stronger_band_glicko"][0], feat["player_elo"] + cfg["cohort"]["stronger_band_glicko"][1]),
        ),
        focus_areas=focus_areas,
        strengths=strengths,
        phase_accuracy=phase_accuracy,
        coach_context=coach_context,
        caveats=caveats,
    )
