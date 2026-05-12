"""Tests for temporal splits."""

from __future__ import annotations

import pandas as pd
import pytest

from ml.features.splits import SplitBoundaries, compute_boundaries, split_temporal


def _df(steps: list[int]) -> pd.DataFrame:
    return pd.DataFrame({"step": steps, "amount": [1.0] * len(steps)})


def test_split_is_chronological_no_overlap() -> None:
    df = _df(list(range(1, 101)))  # 100 rows, steps 1..100
    bounds = compute_boundaries(df, train_frac=0.7, val_frac=0.15)
    train, val, test = split_temporal(df, bounds)

    assert train["step"].max() < val["step"].min()
    assert val["step"].max() < test["step"].min()


def test_split_sizes_approximately_match_fractions() -> None:
    df = _df(list(range(1, 1001)))
    bounds = compute_boundaries(df, train_frac=0.7, val_frac=0.15)
    train, val, test = split_temporal(df, bounds)

    assert 690 <= len(train) <= 710
    assert 140 <= len(val) <= 160
    assert 140 <= len(test) <= 160


def test_split_covers_all_rows() -> None:
    df = _df(list(range(1, 101)))
    bounds = compute_boundaries(df)
    train, val, test = split_temporal(df, bounds)
    assert len(train) + len(val) + len(test) == len(df)


def test_compute_boundaries_rejects_invalid_train_frac() -> None:
    df = _df([1, 2, 3])
    with pytest.raises(ValueError):
        compute_boundaries(df, train_frac=1.5)


def test_compute_boundaries_rejects_invalid_val_frac() -> None:
    df = _df([1, 2, 3])
    with pytest.raises(ValueError):
        compute_boundaries(df, train_frac=0.7, val_frac=0.5)


def test_split_returns_empty_test_when_all_rows_in_train() -> None:
    df = _df([1, 1, 1, 1])  # all same step
    bounds = SplitBoundaries(train_max=1, val_max=1)
    train, val, test = split_temporal(df, bounds)
    assert len(train) == 4
    assert len(val) == 0
    assert len(test) == 0