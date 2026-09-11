"""Fills missing per-ply evals for a user's own games via a local Stockfish
search — only used for games that didn't come with dense ``%eval``
annotations (Lichess "requested analysis" games already have them).
Single-PV, one search per ply needing it: we only need the White-relative
eval of the position after the move, exactly what ``%eval`` itself encodes.
"""

from __future__ import annotations

import chess
import chess.engine


def needs_engine(moves: list[dict], min_coverage: float) -> bool:
    if not moves:
        return False
    have = sum(1 for m in moves if m["eval_cp"] is not None or m["eval_mate"] is not None)
    return have / len(moves) < min_coverage


def fill_evals(moves: list[dict], engine: chess.engine.SimpleEngine, depth: int) -> list[dict]:
    """Returns a new move list with ``eval_cp`` / ``eval_mate`` filled in
    for any ply missing both. ``engine`` is a single long-lived instance
    the caller owns across the whole request (opening one per game would
    pay Stockfish's NNUE-load cost dozens of times over)."""
    board = chess.Board()
    out: list[dict] = []
    limit = chess.engine.Limit(depth=depth)
    for m in moves:
        try:
            board.push(chess.Move.from_uci(m["uci"]))
        except (ValueError, AssertionError):
            break
        row = dict(m)
        if row["eval_cp"] is None and row["eval_mate"] is None:
            info = engine.analyse(board, limit)
            pov = info["score"].white()
            if pov.is_mate():
                row["eval_mate"] = pov.mate()
            else:
                row["eval_cp"] = pov.score()
        out.append(row)
    return out
