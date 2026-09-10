"""The canonical player-vector feature lists — the single definition
stages 06-11 and the service all agree on.

``SKILL`` features feed the skill model (predict Elo). ``STYLE`` features
are residualized against the skill score, then embedded — they should
describe *what a player chooses to do*, as free of raw strength as we can
make them. ``CONTEXT`` columns are carried through but never modelled.
"""

from __future__ import annotations

# competence — "how well"
SKILL = [
    "mean_wp_loss",
    "wp_loss_opening",
    "wp_loss_middlegame",
    "wp_loss_endgame",
    "blunder_rate",
    "mistake_rate",
    "wp_loss_p90",
    "acc_quiet",          # mean wp_loss on quiet, low-complexity positions
    "tactical_gap",       # acc_tactic - acc_quiet
    "complexity_penalty", # wp_loss(high complexity) - wp_loss(low complexity)
    "choke",              # acc_when_winning - acc_when_equal
    "tilt",               # acc_when_losing - acc_when_equal
    "time_scramble_penalty",
    "post_blunder_penalty",
    "endgame_acpl",
    "conversion_rate",
    "save_rate",
    "vigilance_loose_rate",
]

# preference — "what they choose" (residualized vs skill before embedding)
STYLE = [
    "castled_ply_mean",
    "never_castled_rate",
    "castle_queenside_rate",
    "queen_dev_ply_mean",
    "first_dev_ply_mean",
    "check_rate",
    "capture_rate",
    "toward_king_rate",
    "sac_rate",
    "tension_release_rate",
    "pawn_move_rate",
    "mean_think_time",
    "eval_volatility_mean",
    "material_swing_mean",
    "repertoire_entropy",
    "book_exit_ply_mean",
]

# context-conditioned traits (stage 09) — mean (actual - expected) wp_loss
# in each bucket, z-scored across the population. Positive = weakness.
TRAITS = [
    "trait_attention",
    "trait_tactical",
    "trait_calculation",
    "trait_time_pressure",
    "trait_opening_transition",
    "trait_defense",
]

CONTEXT = ["player_hash", "player_elo", "n_games", "n_games_white", "n_games_black"]

MODELLED = SKILL + STYLE
ALL_FEATURES = CONTEXT + MODELLED

# heavy-tailed features → log1p before scaling (applied in stage 08 / service)
LOG_FEATURES = {
    "wp_loss_p90", "mean_think_time", "material_swing_mean", "sac_rate",
    "post_blunder_penalty",
}

# sub-score feature groups for the skill model's 4 dimensions (stage 07)
SKILL_SUBSCORES = {
    "tactical": ["tactical_gap", "blunder_rate", "wp_loss_p90", "vigilance_loose_rate"],
    "positional": ["acc_quiet", "wp_loss_middlegame", "complexity_penalty"],
    "endgame": ["endgame_acpl", "wp_loss_endgame", "conversion_rate", "save_rate"],
    "clock": ["time_scramble_penalty", "mean_think_time"],
}
