"""Chess feature primitives used by stage 02 (and later the service).

All functions take a ``chess.Board`` and are cheap enough to call per ply.
Phase detection mirrors ``features/board/lib/move-analysis.ts::detectGamePhase``.
"""

from __future__ import annotations

import chess

PIECE_VALUE = {
    chess.PAWN: 1.0,
    chess.KNIGHT: 3.0,
    chess.BISHOP: 3.0,
    chess.ROOK: 5.0,
    chess.QUEEN: 9.0,
    chess.KING: 0.0,
}


def material_balance(board: chess.Board) -> float:
    """White pieces minus Black pieces, in pawn units (kings excluded)."""
    bal = 0.0
    for piece_type, value in PIECE_VALUE.items():
        if value == 0.0:
            continue
        bal += value * len(board.pieces(piece_type, chess.WHITE))
        bal -= value * len(board.pieces(piece_type, chess.BLACK))
    return bal


def game_phase(board: chess.Board, ply: int) -> str:
    """opening (<= 20 ply) / endgame (<= 6 major+minor pieces) / middlegame."""
    if ply <= 20:
        return "opening"
    majors_minors = (
        len(board.pieces(chess.KNIGHT, chess.WHITE))
        + len(board.pieces(chess.KNIGHT, chess.BLACK))
        + len(board.pieces(chess.BISHOP, chess.WHITE))
        + len(board.pieces(chess.BISHOP, chess.BLACK))
        + len(board.pieces(chess.ROOK, chess.WHITE))
        + len(board.pieces(chess.ROOK, chess.BLACK))
        + len(board.pieces(chess.QUEEN, chess.WHITE))
        + len(board.pieces(chess.QUEEN, chess.BLACK))
    )
    return "endgame" if majors_minors <= 6 else "middlegame"


def king_distance_delta(board_before: chess.Board, move: chess.Move) -> int | None:
    """How much closer to the *enemy* king the moved piece got (Chebyshev,
    positive = moved toward it). None for a king move or if the enemy king
    is somehow absent."""
    mover = board_before.turn
    enemy_king = board_before.king(not mover)
    if enemy_king is None or board_before.piece_type_at(move.from_square) == chess.KING:
        return None
    before = chess.square_distance(move.from_square, enemy_king)
    after = chess.square_distance(move.to_square, enemy_king)
    return before - after


def pawn_tension(board: chess.Board) -> int:
    """Count of white/black pawn pairs that attack each other — the number
    of pawn captures 'available' in the position regardless of whose turn."""
    count = 0
    black_pawns = board.pieces(chess.PAWN, chess.BLACK)
    for wp in board.pieces(chess.PAWN, chess.WHITE):
        for target in board.attacks(wp):
            if target in black_pawns:
                count += 1
    return count


def has_pawn_capture(board: chess.Board) -> bool:
    """Whether the side to move can capture with a pawn right now."""
    for move in board.legal_moves:
        if board.piece_type_at(move.from_square) == chess.PAWN and board.is_capture(move):
            return True
    return False


_HOME_RANK = {chess.WHITE: 0, chess.BLACK: 7}


def is_developing_move(board_before: chess.Board, move: chess.Move) -> bool:
    """Minor piece (knight/bishop) leaving its own back rank — a rough
    'development' signal, good enough for aggregate rates."""
    piece_type = board_before.piece_type_at(move.from_square)
    if piece_type not in (chess.KNIGHT, chess.BISHOP):
        return False
    return chess.square_rank(move.from_square) == _HOME_RANK[board_before.turn]


def static_exchange_eval(board: chess.Board, move: chess.Move) -> float:
    """Light SEE (no x-ray): material the side to move nets if `move` is a
    capture and the destination square is then traded over with cheapest
    attackers first. Negative => the move loses material outright."""
    if not board.is_capture(move):
        return 0.0

    target = move.to_square
    if board.is_en_passant(move):
        captured_value = PIECE_VALUE[chess.PAWN]
    else:
        captured_piece = board.piece_type_at(target)
        captured_value = PIECE_VALUE.get(captured_piece, 0.0) if captured_piece else 0.0

    gains: list[float] = [captured_value]
    side = not board.turn  # side that will recapture next
    occupied = board.occupied & ~chess.BB_SQUARES[move.from_square]
    on_square_value = PIECE_VALUE.get(board.piece_type_at(move.from_square), 0.0)

    while True:
        attackers = board.attackers_mask(side, target) & occupied
        if not attackers:
            break
        # cheapest attacker
        cheapest_sq = min(
            chess.scan_forward(attackers),
            key=lambda sq: PIECE_VALUE.get(board.piece_type_at(sq), 99.0),
        )
        gains.append(on_square_value - gains[-1])
        on_square_value = PIECE_VALUE.get(board.piece_type_at(cheapest_sq), 0.0)
        occupied &= ~chess.BB_SQUARES[cheapest_sq]
        side = not side

    # negamax back over the capture stack
    for i in range(len(gains) - 2, -1, -1):
        gains[i] = -max(-gains[i], gains[i + 1])
    return gains[0]
