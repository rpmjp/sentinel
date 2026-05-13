"""Temporal train/val/test splits.

Strategy: stratified-temporal hybrid.

Fraud is non-stationary AND severely imbalanced AND non-uniformly distributed
over time in PaySim. A pure temporal split puts most fraud in one tail of the
timeline, starving validation/test of positive examples.

Stratified-temporal split: each class is sorted by step, then split
chronologically. Train/val/test each contain a representative share of fraud
in chronological order. No future-leakage WITHIN a class (a training fraud
case is always earlier than a val/test fraud case), and class balance is
preserved across splits.

This is a defensible technique used in real fraud teams when the target rate
varies over time.
"""

from __future__ import annotations

from dataclasses import dataclass

import pandas as pd


@dataclass(frozen=True)
class StratifiedTemporalSplit:
    """Indices for stratified-temporal train/val/test splits."""

    train_idx: pd.Index
    val_idx: pd.Index
    test_idx: pd.Index


def stratified_temporal_split(
    df: pd.DataFrame,
    target_col: str = "isFraud",
    time_col: str = "step",
    train_frac: float = 0.70,
    val_frac: float = 0.15,
) -> StratifiedTemporalSplit:
    """Per-class chronological split.

    For each class value, sort rows by `time_col` and take the first
    train_frac as train, next val_frac as val, rest as test.

    Within each class:
      - all train rows are temporally before all val rows
      - all val rows are temporally before all test rows
    """
    if not 0 < train_frac < 1:
        raise ValueError(f"train_frac must be in (0, 1), got {train_frac}")
    if not 0 < val_frac < 1 - train_frac:
        raise ValueError(f"val_frac must be in (0, {1 - train_frac}), got {val_frac}")

    train_idx_list: list[pd.Index] = []
    val_idx_list: list[pd.Index] = []
    test_idx_list: list[pd.Index] = []

    for _, group in df.groupby(target_col, sort=False):
        sorted_group = group.sort_values(time_col)
        n = len(sorted_group)
        n_train = int(n * train_frac)
        n_val = int(n * (train_frac + val_frac))

        train_idx_list.append(sorted_group.index[:n_train])
        val_idx_list.append(sorted_group.index[n_train:n_val])
        test_idx_list.append(sorted_group.index[n_val:])

    return StratifiedTemporalSplit(
        train_idx=train_idx_list[0].append(train_idx_list[1:]) if train_idx_list else pd.Index([]),
        val_idx=val_idx_list[0].append(val_idx_list[1:]) if val_idx_list else pd.Index([]),
        test_idx=test_idx_list[0].append(test_idx_list[1:]) if test_idx_list else pd.Index([]),
    )


def split_stratified_temporal(
    df: pd.DataFrame,
    target_col: str = "isFraud",
    time_col: str = "step",
    train_frac: float = 0.70,
    val_frac: float = 0.15,
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """Convenience wrapper returning the actual DataFrames."""
    split = stratified_temporal_split(df, target_col, time_col, train_frac, val_frac)
    return df.loc[split.train_idx], df.loc[split.val_idx], df.loc[split.test_idx]