"""Shared synthetic-but-real-format test data: valid PGN text (real legal
moves via python-chess, with `%eval`/`%clk` annotations statistically
correlated with a hidden 'true Elo'), and a helper that runs the *real*
pipeline stages over it to produce a small reference `artifacts/` tree —
used by both the stage-04-and-later pipeline tests and the service test.
"""

from __future__ import annotations

import importlib.util
import math
import pathlib
import random

import chess
import numpy as np
import polars as pl

ROOT = pathlib.Path(__file__).resolve().parents[1]


def load_stage(name: str, filename: str):
    spec = importlib.util.spec_from_file_location(name, ROOT / "pipeline" / filename)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def _wp_to_cp(wp: float) -> int:
    wp = min(99.0, max(1.0, wp))
    return int(round(350.0 * math.atanh(wp / 50.0 - 1.0)))


def _fmt_clock(seconds: int) -> str:
    seconds = max(0, seconds)
    return f"{seconds // 3600}:{(seconds % 3600) // 60:02d}:{seconds % 60:02d}"


def random_game_pgn(
    rng: random.Random,
    game_id: str,
    white: str, black: str, white_elo: int, black_elo: int,
    true_elo: dict[str, int],
    n_ply: int, base_seconds: int = 300,
) -> str | None:
    """A real, legal, randomly-played blitz game as Lichess-style PGN text,
    with `%eval`/`%clk` comments whose *statistics* (not chess merit) are
    correlated with each mover's ``true_elo`` — enough signal for the
    pipeline's models to learn something real on, without needing an
    actual engine for the reference fixture."""
    board = chess.Board()
    clocks = {"w": base_seconds, "b": base_seconds}
    wp_white = 50.0
    parts = []
    for ply in range(1, n_ply + 1):
        legal = list(board.legal_moves)
        if not legal:
            break
        move = rng.choice(legal)
        san = board.san(move)
        board.push(move)

        mover = "w" if ply % 2 == 1 else "b"
        mover_name = white if mover == "w" else black
        weakness = max(0.0, (2050 - true_elo[mover_name]) / 1100.0)
        wp_loss = float(np.clip(rng.gammavariate(2.0, 1.0 + 5.0 * weakness), 0, 55))
        delta = wp_loss if mover == "b" else -wp_loss  # loss hurts the mover's own side
        wp_white = float(np.clip(wp_white + delta, 1, 99))

        clocks[mover] = max(5, clocks[mover] - rng.randint(2, 15))
        move_no = f"{(ply + 1) // 2}." if mover == "w" else ""
        parts.append(
            f"{move_no}{san} {{ [%eval {_wp_to_cp(wp_white) / 100:.2f}] [%clk {_fmt_clock(clocks[mover])}] }}"
        )
        if board.is_game_over():
            break

    if len(parts) < 10:
        return None
    result = board.result() if board.is_game_over() else rng.choice(["1-0", "0-1", "1/2-1/2"])
    headers = (
        f'[Event "Rated blitz game"]\n[Site "https://lichess.org/{game_id}"]\n'
        f'[White "{white}"]\n[Black "{black}"]\n[Result "{result}"]\n'
        f'[UTCDate "{"2024.06.%02d" % (1 + int(game_id[-2:], 36) % 27)}"]\n[UTCTime "12:00:00"]\n'
        f'[WhiteElo "{white_elo}"]\n[BlackElo "{black_elo}"]\n'
        f'[TimeControl "{base_seconds}+0"]\n[Termination "Normal"]\n[ECO "{rng.choice(["B10","C50","D02","A45"])}"]\n'
    )
    return headers + "\n" + " ".join(parts) + f" {result}\n"


def build_reference(month_dir: pathlib.Path, art_dir: pathlib.Path, cfg: dict, seed: int = 5) -> None:
    """Generates ~40 players' worth of real PGN, then runs the actual
    stages 02, 04(synthetic labels)-11 to produce a full artifacts/ tree."""
    rng = random.Random(seed)
    (month_dir / "games").mkdir(parents=True, exist_ok=True)
    (month_dir / "moves").mkdir(parents=True, exist_ok=True)

    n_players = 40
    names = [f"p{i:02d}" for i in range(n_players)]
    true_elo = {n: rng.randint(950, 2050) for n in names}

    from pipeline.common import pgn as pgnmod

    games_rows, moves_rows = [], []
    gid = 0
    for me in names:
        for _ in range(rng.randint(16, 24)):
            opp = rng.choice(names)
            if opp == me:
                continue
            gid += 1
            game_id = f"g{gid:06d}"
            i_am_white = rng.random() < 0.5
            white, black = (me, opp) if i_am_white else (opp, me)
            pgn_text = random_game_pgn(
                rng, game_id, white, black,
                true_elo[white] + rng.randint(-40, 40), true_elo[black] + rng.randint(-40, 40),
                true_elo, n_ply=rng.randint(44, 78),
            )
            if pgn_text is None:
                continue
            for headers_text, movetext in pgnmod.iter_raw_games(__import__("io").StringIO(pgn_text), 1 << 20):
                h = pgnmod.parse_headers(headers_text)
                parsed = pgnmod.parse_full_game(headers_text, movetext)
                if parsed is None:
                    continue
                game, real_gid, move_rows, evaled, _clocked = parsed
                games_rows.append(
                    {
                        "game_id": real_gid, "white": h["White"], "black": h["Black"],
                        "white_elo": int(h["WhiteElo"]), "black_elo": int(h["BlackElo"]),
                        "time_control": h["TimeControl"], "speed": "blitz",
                        "eco": h.get("ECO"), "opening": None, "termination": h.get("Termination"),
                        "result": h["Result"], "utc_date": h["UTCDate"], "utc_time": h["UTCTime"],
                        "ply_count": len(move_rows), "eval_coverage": evaled / len(move_rows),
                        "has_clocks": True,
                    }
                )
                moves_rows.extend(
                    (r["game_id"], r["ply"], r["san"], r["uci"], r["eval_cp"], r["eval_mate"], r["clock_cs"])
                    for r in move_rows
                )

    pl.DataFrame(games_rows).write_parquet(month_dir / "games" / "part_00000.parquet")
    pl.DataFrame(
        moves_rows, schema=["game_id", "ply", "san", "uci", "eval_cp", "eval_mate", "clock_cs"], orient="row"
    ).write_parquet(month_dir / "moves" / "part_00000.parquet")

    cfg["paths"]["artifacts_dir"] = art_dir
    cfg["player_vectors"].update(min_games=8, min_games_with_clocks=0, max_games_per_player=100)
    from pipeline.common import config as cfgmod

    cfgmod.load = lambda: cfg  # noqa: E731
    cfgmod.month_dir = lambda _c=None: month_dir  # noqa: E731

    s02 = load_stage("s02_fx", "02_move_features.py")
    s02.run()

    # stage 04 needs an "engine_labels" sample — fabricate it the same way
    # smoke_stage04 does (a noisy function of the static features), skipping
    # the real Stockfish pass (covered separately by engine_check.py).
    mf = pl.read_parquet(month_dir / "move_features" / "*.parquet")
    from pipeline.common.chessext import STATIC_FEATURE_NAMES

    n = mf.height
    checks = mf["st_checks_available"].to_numpy()
    legal = mf["st_legal_moves"].to_numpy()
    see = mf["see"].to_numpy()
    r = np.random.default_rng(seed)
    has_tactic = (checks + r.normal(0, 1, n)) > 2.5
    only_move = (checks + r.normal(0, 1.5, n)) > 3.5
    complexity = legal * 0.8 + r.normal(0, 5, n)
    wp_loss_engine = np.clip(-see * 2 + r.normal(3, 3, n), 0, None)
    mask = r.random(n) < 0.15
    labels = pl.DataFrame(
        {
            "game_id": mf["game_id"], "ply": mf["ply"],
            "has_tactic": pl.Series(has_tactic, dtype=pl.Boolean),
            "only_move": pl.Series([None if m else bool(v) for m, v in zip(mask, only_move)], dtype=pl.Boolean),
            "complexity": pl.Series([None if m else float(v) for m, v in zip(mask, complexity)], dtype=pl.Float64),
            "wp_loss_engine": wp_loss_engine,
        }
    )
    (month_dir / "engine_labels").mkdir(exist_ok=True)
    labels.write_parquet(month_dir / "engine_labels" / "part_00000.parquet")

    for name, fname in [
        ("s04_fx", "04_feature_models.py"), ("s05_fx", "05_game_agg.py"),
        ("s06_fx", "06_player_vectors.py"), ("s07_fx", "07_skill_model.py"),
        ("s08_fx", "08_style_embedding.py"), ("s09_fx", "09_trait_models.py"),
        ("s10_fx", "10_export_artifacts.py"),
    ]:
        load_stage(name, fname).run()
