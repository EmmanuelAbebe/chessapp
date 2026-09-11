"""Human-readable names for the MODELLED features - feature keys like
"wp_loss_opening" are the right vocabulary for the pipeline and the raw
Evidence data, but not for a title or a label a player reads. Used by
profile.py to fill FocusArea.title / Strength.title / Evidence.label /
SignatureItem.text.
"""

from __future__ import annotations

FEATURE_LABELS: dict[str, str] = {
    # skill (competence) - most are "a drop/rate", lower is usually better;
    # the service's LOWER_IS_BETTER map (not this one) carries direction.
    "mean_wp_loss": "Overall move accuracy",
    "wp_loss_opening": "Opening accuracy",
    "wp_loss_middlegame": "Middlegame accuracy",
    "wp_loss_endgame": "Endgame accuracy",
    "blunder_rate": "Blunder rate",
    "mistake_rate": "Mistake rate",
    "wp_loss_p90": "Worst-case move quality",
    "acc_quiet": "Accuracy in quiet positions",
    "tactical_gap": "Accuracy drop in tactical positions",
    "complexity_penalty": "Accuracy drop in complex positions",
    "choke": "Accuracy drop when winning",
    "tilt": "Accuracy drop when losing",
    "time_scramble_penalty": "Accuracy drop under time pressure",
    "post_blunder_penalty": "Recovery after a blunder",
    "endgame_acpl": "Endgame technique",
    "conversion_rate": "Converting winning positions",
    "save_rate": "Saving losing positions",
    "vigilance_loose_rate": "Leaving pieces hanging",
    # style (preference) - no good/bad direction, just what you tend to do
    "castled_ply_mean": "When you castle",
    "never_castled_rate": "How often you skip castling",
    "castle_queenside_rate": "Queenside castling",
    "queen_dev_ply_mean": "When you bring your queen out",
    "first_dev_ply_mean": "When you start developing",
    "check_rate": "How often you give check",
    "capture_rate": "How often you capture",
    "toward_king_rate": "Attacking toward the enemy king",
    "sac_rate": "Sacrificing material",
    "tension_release_rate": "Resolving pawn tension",
    "pawn_move_rate": "Pawn moves",
    "mean_think_time": "Time per move",
    "eval_volatility_mean": "How swingy your games are",
    "material_swing_mean": "Material swings",
    "repertoire_entropy": "Opening variety",
    "book_exit_ply_mean": "Opening knowledge depth",
}


def label_for(feature: str) -> str:
    return FEATURE_LABELS.get(feature, feature.replace("_", " ").title())
