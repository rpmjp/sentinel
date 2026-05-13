"""Tests for stratified random splits."""

from __future__ import annotations

import pandas as pd
import pytest

from ml.features.splits import split_stratified


def _df(n_rows: int, fraud_rate: float = 0.001) -> pd.DataFrame:
    n_fraud = max(int(n_rows * fraud_rate), 10)
    labels = [1] * n_fraud + [0] * (n_rows - n_fraud)
    return pd.DataFrame(
        {"step": list(range(n_rows)), "isFraud": labels, "amount": [1.0] * n_rows}
    )


def test_each_split_contains_both_classes() -> None:
    df = _df(10000)
    train, val, test = split_stratified(df)
    assert train["isFraud"].sum() > 0
    assert val["isFraud"].sum() > 0
    assert test["isFraud"].sum() > 0


def test_fraud_rate_preserved_across_splits() -> None:
    df = _df(100000, fraud_rate=0.005)
    train, val, test = split_stratified(df)
    base_rate = df["isFraud"].mean()
    for split in [train, val, test]:
        assert abs(split["isFraud"].mean() - base_rate) < 0.001


def test_split_sizes_match_fractions() -> None:
    df = _df(10000)
    train, val, test = split_stratified(df, train_frac=0.7, val_frac=0.15)
    n = len(df)
    assert abs(len(train) - int(n * 0.7)) <= 2
    assert abs(len(val) - int(n * 0.15)) <= 2
    assert abs(len(test) - int(n * 0.15)) <= 2


def test_all_rows_covered_no_overlap() -> None:
    df = _df(10000)
    train, val, test = split_stratified(df)
    assert len(train) + len(val) + len(test) == len(df)
    all_idx = set(train.index) | set(val.index) | set(test.index)
    assert len(all_idx) == len(df)


def test_rejects_invalid_fractions() -> None:
    df = _df(1000)
    with pytest.raises(ValueError):
        split_stratified(df, train_frac=1.5)
    with pytest.raises(ValueError):
        split_stratified(df, train_frac=0.7, val_frac=0.5)


def test_reproducible_with_seed() -> None:
    df = _df(1000)
    t1, v1, te1 = split_stratified(df, random_state=42)
    t2, v2, te2 = split_stratified(df, random_state=42)
    pd.testing.assert_frame_equal(t1, t2)
    pd.testing.assert_frame_equal(v1, v2)
    pd.testing.assert_frame_equal(te1, te2)