"""Train/val/test splits.

Strategy: stratified random.

Rationale: PaySim's `step` variable is non-uniform simulator output — row
volume and fraud rate vary by 10x across step ranges, with no realistic
"time-evolving patterns" the way real fraud does. Diagnostic analysis showed
temporal splits produce train/val distributions different enough that the
model fits train cleanly but fails on val (val logloss ~22, val PR-AUC <0.01).

For PaySim specifically, stratified random gives realistic train/val/test
distributions. Real-world temporal honesty is enforced in Phase 4 via
production drift monitoring and scheduled retraining, not via the train split.

Documented in docs/model_card.md.
"""

from __future__ import annotations

from dataclasses import dataclass

import pandas as pd
from sklearn.model_selection import train_test_split


@dataclass(frozen=True)
class StratifiedSplit:
    """Indices for stratified train/val/test splits."""

    train_idx: pd.Index
    val_idx: pd.Index
    test_idx: pd.Index


def split_stratified(
    df: pd.DataFrame,
    target_col: str = "isFraud",
    train_frac: float = 0.70,
    val_frac: float = 0.15,
    random_state: int = 42,
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """Stratified random split into (train, val, test).

    Preserves the class ratio in each split.
    """
    if not 0 < train_frac < 1:
        raise ValueError(f"train_frac must be in (0, 1), got {train_frac}")
    if not 0 < val_frac < 1 - train_frac:
        raise ValueError(f"val_frac must be in (0, {1 - train_frac}), got {val_frac}")

    test_frac = 1.0 - train_frac - val_frac

    train, temp = train_test_split(
        df,
        test_size=val_frac + test_frac,
        stratify=df[target_col],
        random_state=random_state,
    )
    val, test = train_test_split(
        temp,
        test_size=test_frac / (val_frac + test_frac),
        stratify=temp[target_col],
        random_state=random_state,
    )
    return train, val, test