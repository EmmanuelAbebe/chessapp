"""Per-ply feature extraction — the one function both the batch pipeline
(stage 02) and the inference service call, so a user's games and the
reference population are computed identically.
"""

from __future__ import annotations

import chess
import polars as pl

from pipeline.common import chessext
from pipeline.common.evalscale import classify, white_percent, white_score

FEATURE_SCHEMA = {
    "game_id": pl.Utf8,
    "ply": pl.Int16,
    "mover": pl.Utf8,
    "san": pl.Utf8,
    "uci": pl.Utf8,
    "eval_cp": pl.Int32,
    "eval_mate": pl.Int8,
    "clock_cs": pl.Int32,
    "wp_white_after": pl.Float32,
    "wp_loss": pl.Float32,
    "classification": pl.Utf8,
    "phase": pl.Utf8,
    "material_white": pl.Float32,
    "material_swing": pl.Float32,
    "piece_moved": pl.Utf8,
    "is_capture": pl.Boolean,
    "is_check": pl.Boolean,
    "is_castle": pl.Boolean,
    "is_dev_move": pl.Boolean,
    "is_pawn_push": pl.Boolean,
    "king_dist_delta": pl.Int8,
    "see": pl.Float32,
    "pawn_tension_before": pl.Int8,
    "released_tension": pl.Boolean,
    "is_defending": pl.Boolean,
    "think_time_s": pl.Float32,
    "legal_moves_before": pl.Int16,
    "epd_before": pl.Utf8,
    **{name: pl.Float32 for name in chessext.STATIC_FEATURE_NAMES},
}

_PIECE_LETTER = {
    chess.PAWN: "p", chess.KNIGHT: "n", chess.BISHOP: "b",
    chess.ROOK: "r", chess.QUEEN: "q", chess.KING: "k",
}


def features_for_game(
    moves: list[dict], inc: int, base: int, book_max_ply: int, thr: dict
) -> list[dict] | None:
    """``moves`` = the game's plies in order, each
    ``{game_id, ply, san, uci, eval_cp, eval_mate, clock_cs}``. Returns one
    row per ply matching ``FEATURE_SCHEMA`` (minus book columns — see
    ``apply_book_tags``), or ``None`` if a move doesn't replay legally."""
    board = chess.Board()
    rows: list[dict] = []
    prev_material = 0.0
    prev_white_pct: float | None = None
    clocks: list[int | None] = [None]  # index 0 unused; clocks[ply] is 1-indexed

    for m in moves:
        ply = m["ply"]
        mover = "w" if board.turn == chess.WHITE else "b"
        move = chess.Move.from_uci(m["uci"])
        if move not in board.legal_moves:
            return None

        eval_cp, eval_mate = m["eval_cp"], m["eval_mate"]
        wp_white_after = white_percent(white_score(eval_cp, eval_mate))
        mover_pct_after = wp_white_after if mover == "w" else 100.0 - wp_white_after
        wp_loss = None
        classification = None
        if prev_white_pct is not None:
            mover_pct_before = prev_white_pct if mover == "w" else 100.0 - prev_white_pct
            wp_loss = max(0.0, mover_pct_before - mover_pct_after)
            classification = classify(wp_loss, thr)

        is_defending = False
        if prev_white_pct is not None:
            mover_cp_before = (prev_white_pct - 50.0) * (1 if mover == "w" else -1)
            is_defending = mover_cp_before <= -7.0  # ~ -0.5 pawn in win% terms

        see = chessext.static_exchange_eval(board, move)
        kdd = chessext.king_distance_delta(board, move)
        tension_before = chessext.pawn_tension(board)
        piece_moved = _PIECE_LETTER.get(board.piece_type_at(move.from_square))
        is_pawn = board.piece_type_at(move.from_square) == chess.PAWN
        is_cap = board.is_capture(move)
        is_castle = board.is_castling(move)
        released = bool(is_pawn and is_cap)
        legal_before = board.legal_moves.count()
        dev = chessext.is_developing_move(board, move)
        epd_before = board.epd() if ply <= book_max_ply else None
        static = chessext.static_features(board)

        board.push(move)
        material = chessext.material_balance(board)
        gives_check = board.is_check()
        phase = chessext.game_phase(board, ply)

        think = None
        clk = m["clock_cs"]
        clocks.append(clk)
        if ply >= 3 and clk is not None and clocks[ply - 2] is not None:
            raw = (clocks[ply - 2] - clk) / 100.0 + inc
            if 0.0 <= raw <= max(base, 1):
                think = raw

        rows.append(
            {
                "game_id": m["game_id"], "ply": ply, "mover": mover,
                "san": m["san"], "uci": m["uci"],
                "eval_cp": eval_cp, "eval_mate": eval_mate, "clock_cs": clk,
                "wp_white_after": wp_white_after, "wp_loss": wp_loss,
                "classification": classification, "phase": phase,
                "material_white": material, "material_swing": abs(material - prev_material),
                "piece_moved": piece_moved, "is_capture": is_cap, "is_check": gives_check,
                "is_castle": is_castle, "is_dev_move": dev,
                "is_pawn_push": bool(is_pawn and not is_cap),
                "king_dist_delta": kdd, "see": see,
                "pawn_tension_before": min(tension_before, 127),
                "released_tension": released, "is_defending": is_defending,
                "think_time_s": think, "legal_moves_before": legal_before,
                "epd_before": epd_before, **static,
            }
        )
        prev_material = material
        prev_white_pct = wp_white_after

    return rows


def apply_book_tags(df: pl.DataFrame, book_set: set[tuple[str, str]]) -> pl.DataFrame:
    """Adds ``in_book`` / ``plies_since_book_exit`` from a population
    ``{(epd_before, uci)}`` set and drops the now-unneeded ``epd_before`` /
    the intermediate ``book_move`` column. Same logic stage 02 uses on the
    reference set and the service uses on one user's games."""
    book_move = [
        (e is not None) and ((e, u) in book_set)
        for e, u in zip(df["epd_before"], df["uci"])
    ]
    df = df.with_columns(pl.Series("book_move", book_move))
    df = df.with_columns(
        in_book=(pl.col("book_move").cast(pl.Int8).cum_min().over("game_id") == 1)
    )
    last = (
        df.filter("in_book")
        .group_by("game_id")
        .agg(pl.col("ply").max().alias("last_in_book_ply"))
    )
    df = df.join(last, on="game_id", how="left").with_columns(
        pl.col("last_in_book_ply").fill_null(0)
    )
    return df.with_columns(
        plies_since_book_exit=pl.when("in_book")
        .then(0)
        .otherwise(pl.col("ply") - pl.col("last_in_book_ply"))
        .cast(pl.Int16)
    ).drop("book_move", "last_in_book_ply", "epd_before")
