"""Quick offline check of stages 01-02 without downloading anything.

Feeds an in-memory Lichess-style PGN through the streaming splitter, the
header filter, the full parse, and the per-ply feature extractor, then
prints a summary. Run: `.venv/bin/python tests/smoke.py`
"""

from __future__ import annotations

import io
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from pipeline.common import config as cfgmod
from pipeline.common import pgn as pgnmod
from pipeline.common.filters import header_ok, speed_bucket
from pipeline.common.movefeatures import features_for_game

# import stage 02's feature function by file path (module name starts with a digit)
import importlib.util

_spec = importlib.util.spec_from_file_location(
    "s02", pathlib.Path(__file__).resolve().parents[1] / "pipeline" / "02_move_features.py"
)
s02 = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(s02)

BLITZ_GAME = """[Event "Rated blitz game"]
[Site "https://lichess.org/abcd1234"]
[White "alice"]
[Black "bob"]
[Result "1-0"]
[UTCDate "2024.06.01"]
[UTCTime "12:00:00"]
[WhiteElo "1600"]
[BlackElo "1590"]
[TimeControl "300+0"]
[Termination "Normal"]
[ECO "C51"]
[Opening "Evans Gambit"]

1. e4 { [%eval 0.0] [%clk 0:05:00] } 1... e5 { [%eval 0.1] [%clk 0:05:00] } 2. Nf3 { [%eval 0.0] [%clk 0:04:58] } 2... Nc6 { [%eval 0.1] [%clk 0:04:57] } 3. Bc4 { [%eval 0.0] [%clk 0:04:56] } 3... Bc5 { [%eval 0.2] [%clk 0:04:55] } 4. b4 { [%eval -0.3] [%clk 0:04:50] } 4... Bxb4 { [%eval -0.2] [%clk 0:04:40] } 5. c3 { [%eval -0.3] [%clk 0:04:45] } 5... Ba5 { [%eval -0.1] [%clk 0:04:30] } 6. d4 { [%eval -0.4] [%clk 0:04:40] } 6... exd4 { [%eval -0.3] [%clk 0:04:20] } 7. O-O { [%eval -0.5] [%clk 0:04:35] } 7... dxc3 { [%eval -1.5] [%clk 0:04:00] } 8. Qb3 { [%eval -1.2] [%clk 0:04:30] } 8... Qf6 { [%eval -0.8] [%clk 0:03:50] } 9. e5 { [%eval -1.0] [%clk 0:04:20] } 9... Qg6 { [%eval -0.9] [%clk 0:03:40] } 10. Nxc3 { [%eval -1.1] [%clk 0:04:10] } 10... Nge7 { [%eval -0.8] [%clk 0:03:30] } 1-0
"""

BULLET_GAME = """[Event "Rated bullet game"]
[Site "https://lichess.org/zzzz9999"]
[White "carol"]
[Black "dave"]
[Result "0-1"]
[WhiteElo "2000"]
[BlackElo "2010"]
[TimeControl "60+0"]
[Termination "Normal"]

1. d4 { [%eval 0.2] } 1... d5 { [%eval 0.1] } 2. c4 { [%eval 0.0] } 2... e6 { [%eval 0.1] } 0-1
"""

PGN = BLITZ_GAME + "\n" + BULLET_GAME + "\n"


def main() -> None:
    cfg = cfgmod.load()
    ing = cfg["ingest"]
    mf = cfg["move_features"]

    stream = io.StringIO(PGN)
    seen = kept = 0
    for headers_text, movetext in pgnmod.iter_raw_games(stream, 64):
        seen += 1
        h = pgnmod.parse_headers(headers_text)
        ok = header_ok(h, ing)
        print(f"game {seen}: {h.get('Site')} speed={speed_bucket(h.get('TimeControl'))} header_ok={ok}")
        if not ok:
            continue
        kept += 1

        import chess.pgn

        game = chess.pgn.read_game(io.StringIO(f"{headers_text}\n\n{movetext}\n"))
        moves = []
        board = game.board()
        for ply, node in enumerate(game.mainline(), start=1):
            comment = node.comment or ""
            ev = pgnmod.EVAL_RE.search(comment)
            cp, mate = pgnmod.parse_eval_token(ev.group(1)) if ev else (None, None)
            moves.append(
                {
                    "game_id": "abcd1234",
                    "ply": ply,
                    "san": board.san(node.move),
                    "uci": node.move.uci(),
                    "eval_cp": cp,
                    "eval_mate": mate,
                    "clock_cs": pgnmod.clock_to_cs(pgnmod.CLK_RE.search(comment)),
                }
            )
            board.push(node.move)

        rows = features_for_game(moves, inc=0, base=300, book_max_ply=mf["book_max_ply"], thr=mf["classify"])
        assert rows is not None and len(rows) == len(moves)
        print(f"  parsed {len(rows)} plies")
        for r in rows:
            if r["ply"] in (8, 14):  # 7...dxc3 area — the Evans pawn grab
                print(
                    f"  ply {r['ply']:>2} {r['san']:<6} mover={r['mover']} "
                    f"wp_loss={r['wp_loss']!s:<6.6} class={r['classification']} "
                    f"phase={r['phase']} see={r['see']:+.1f} tension={r['pawn_tension_before']} "
                    f"think={r['think_time_s']} legal={r['legal_moves_before']}"
                )

    print(f"\nseen={seen} kept={kept}  (expect seen=2 kept=1)")
    assert (seen, kept) == (2, 1), (seen, kept)

    _test_stage02_pipeline(cfg, mf)
    print("SMOKE OK")


def _test_stage02_pipeline(cfg, mf) -> None:
    """Write a tiny games/moves parquet and run stage 02's two phases end
    to end — exercises the polars book/group_by logic the unit check above
    skips."""
    import shutil
    import chess.pgn
    import polars as pl

    tmp = pathlib.Path(__file__).resolve().parents[1] / "data" / "_smoke"
    if tmp.exists():
        shutil.rmtree(tmp)
    (tmp / "games").mkdir(parents=True)
    (tmp / "moves").mkdir(parents=True)

    game = chess.pgn.read_game(io.StringIO(BLITZ_GAME))
    board = game.board()
    move_rows = []
    for ply, node in enumerate(game.mainline(), start=1):
        comment = node.comment or ""
        ev = pgnmod.EVAL_RE.search(comment)
        cp, mate = pgnmod.parse_eval_token(ev.group(1)) if ev else (None, None)
        move_rows.append(
            ("abcd1234", ply, board.san(node.move), node.move.uci(), cp, mate,
             pgnmod.clock_to_cs(pgnmod.CLK_RE.search(comment)))
        )
        board.push(node.move)

    pl.DataFrame(
        [{"game_id": "abcd1234", "time_control": "300+0"}]
    ).write_parquet(tmp / "games" / "part_00000.parquet")
    pl.DataFrame(
        move_rows,
        schema=["game_id", "ply", "san", "uci", "eval_cp", "eval_mate", "clock_cs"],
        orient="row",
    ).write_parquet(tmp / "moves" / "part_00000.parquet")

    raw_dir = s02._phase_a(cfg, tmp, mf["classify"], mf["book_max_ply"])
    s02._phase_b(tmp, raw_dir, book_min_count=1)  # count=1 so the single game forms a "book"

    out = pl.read_parquet(tmp / "move_features" / "*.parquet").sort("ply")
    assert out.height == 20, out.height
    cols = set(out.columns)
    assert {"in_book", "plies_since_book_exit", "wp_loss", "classification"} <= cols, cols
    # every ply is its own book here (min_count=1), so in_book stays true throughout
    assert out["in_book"].all(), out.select("ply", "in_book")
    print(f"stage-02 pipeline: {out.height} rows, cols={len(cols)}, book ok")
    shutil.rmtree(tmp)


if __name__ == "__main__":
    main()
