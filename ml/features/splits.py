"""Temporal train/val/test splits.

Fraud is non-stationary — random splits leak future patterns into training.
We split by `step` (the simulator's hour counter, 1..744).

Default split: 70% train / 15% val / 15% test, in chronological order.
"""

from __future__ import annotations

from dataclasses import dataclass

import pandas as pd


@dataclass(frozen=True)
class SplitBoundaries:
    """Step thresholds defining the splits.

    Rows with step <= train_max go to train.
    Rows with train_max < step <= val_max go to val.
    Rows with step > val_max go to test.
    """

    train_max: int
    val_max: int


def compute_boundaries(
    df: pd.DataFrame,
    train_frac: float = 0.70,
    val_frac: float = 0.15,
) -> SplitBoundaries:
    """Compute step thresholds for a temporal split.

    Boundaries are based on the row distribution across steps, not on the
    step range itself, since transaction volume varies over time.
    """
    if not 0 < train_frac < 1:
        raise ValueError(f"train_frac must be in (0, 1), got {train_frac}")
    if not 0 < val_frac < 1 - train_frac:
        raise ValueError(f"val_frac must be in (0, {1 - train_frac}), got {val_frac}")

    steps_sorted = df["step"].sort_values().reset_index(drop=True)
    n = len(steps_sorted)
    train_idx = int(n * train_frac)
    val_idx = int(n * (train_frac + val_frac))

    return SplitBoundaries(
        train_max=int(steps_sorted.iloc[train_idx - 1]),
        val_max=int(steps_sorted.iloc[val_idx - 1]),
    )


def split_temporal(
    df: pd.DataFrame,
    boundaries: SplitBoundaries,
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """Split a DataFrame by step into (train, val, test)."""
    train = df[df["step"] <= boundaries.train_max]
    val = df[(df["step"] > boundaries.train_max) & (df["step"] <= boundaries.val_max)]
    test = df[df["step"] > boundaries.val_max]
    return train, val, test
