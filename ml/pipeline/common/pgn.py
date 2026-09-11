"""Streaming reader for the Lichess monthly ``.pgn.zst`` dump.

The dump is ~25 GB compressed / ~100 GB raw — far too big to land on disk.
This module streams it over HTTP, decompresses on the fly, and yields one
raw ``(headers_text, movetext)`` pair at a time. Cheap header filtering
happens on the text; only games that pass get handed to python-chess.

Lichess formats every game as::

    [Event "..."]
    ...more header lines...
    <blank line>
    1. e4 { [%eval 0.17] [%clk 0:03:00] } 1... c5 { ... } ... 1-0
    <blank line>

so splitting the decompressed text on blank lines yields alternating
header / movetext blocks.
"""

from __future__ import annotations

import io
import re
import urllib.request
from collections.abc import Iterator

import chess.pgn
import zstandard

_HEADER_RE = re.compile(r'^\[([A-Za-z0-9_]+)\s+"(.*)"\]\s*$', re.MULTILINE)
_EVAL_RE = re.compile(r"\[%eval\s+(#?-?\d+(?:\.\d+)?)\]")
_CLK_RE = re.compile(r"\[%clk\s+(\d+):(\d+):(\d+)\]")


def open_stream(url: str, timeout_s: int) -> io.TextIOWrapper:
    """A text file object over the decompressed dump. Never buffers the
    whole thing — reads propagate down through zstd to the socket."""
    resp = urllib.request.urlopen(url, timeout=timeout_s)  # noqa: S310 (trusted host)
    reader = zstandard.ZstdDecompressor().stream_reader(resp)
    return io.TextIOWrapper(reader, encoding="utf-8", errors="replace")


def iter_raw_games(
    stream: io.TextIOWrapper, chunk_bytes: int
) -> Iterator[tuple[str, str]]:
    """Yield ``(headers_text, movetext)`` for each game in the stream."""
    buf = ""
    pending_headers: str | None = None
    while True:
        chunk = stream.read(chunk_bytes)
        if not chunk:
            break
        buf += chunk
        while "\n\n" in buf:
            block, buf = buf.split("\n\n", 1)
            block = block.strip("\n")
            if not block:
                continue
            if block.startswith("["):
                pending_headers = block
            elif pending_headers is not None:
                yield pending_headers, block
                pending_headers = None
    tail = buf.strip()
    if pending_headers is not None and tail:
        yield pending_headers, tail


def parse_headers(headers_text: str) -> dict[str, str]:
    return {k: v for k, v in _HEADER_RE.findall(headers_text)}


def eval_coverage(movetext: str, ply_count: int) -> float:
    if ply_count == 0:
        return 0.0
    return len(_EVAL_RE.findall(movetext)) / ply_count


def parse_eval_token(token: str) -> tuple[int | None, int | None]:
    """``"0.24"`` -> (24, None); ``"#-3"`` -> (None, -3); ``"#3"`` -> (None, 3)."""
    if token.startswith("#"):
        return None, int(token[1:])
    return round(float(token) * 100), None


def clock_to_cs(match: re.Match[str] | None) -> int | None:
    if match is None:
        return None
    h, m, s = (int(g) for g in match.groups())
    return (h * 3600 + m * 60 + s) * 100


EVAL_RE = _EVAL_RE
CLK_RE = _CLK_RE


def parse_full_game(headers_text: str, movetext: str):
    """Full parse of one already header-filtered game: replays the
    movetext, pulling ``%eval`` / ``%clk`` off each move's comment. Returns
    ``(game, game_id, move_rows, evaled, clocked)`` or ``None`` if it fails
    to parse / replay — ``move_rows`` is a list of dicts
    (``game_id, ply, san, uci, eval_cp, eval_mate, clock_cs``), the exact
    shape ``movefeatures.features_for_game`` expects. Shared by stage 01
    (the reference dump) and the inference service (a user's own PGN)."""
    game = chess.pgn.read_game(io.StringIO(f"{headers_text}\n\n{movetext}\n"))
    if game is None or game.errors:
        return None

    h = game.headers
    game_id = h.get("Site", "").rstrip("/").rsplit("/", 1)[-1]
    if not game_id:
        return None

    board = game.board()
    move_rows: list[dict] = []
    clocked = 0
    evaled = 0
    for ply, node in enumerate(game.mainline(), start=1):
        move = node.move
        try:
            san = board.san(move)
        except (AssertionError, ValueError):
            return None
        comment = node.comment or ""
        ev = _EVAL_RE.search(comment)
        eval_cp, eval_mate = parse_eval_token(ev.group(1)) if ev else (None, None)
        clock_cs = clock_to_cs(_CLK_RE.search(comment))
        if eval_cp is not None or eval_mate is not None:
            evaled += 1
        if clock_cs is not None:
            clocked += 1
        move_rows.append(
            {
                "game_id": game_id, "ply": ply, "san": san, "uci": move.uci(),
                "eval_cp": eval_cp, "eval_mate": eval_mate, "clock_cs": clock_cs,
            }
        )
        board.push(move)

    return game, game_id, move_rows, evaled, clocked
