"""Tests for stratified-temporal splits."""

from __future__ import annotations

import pandas as pd
import pytest

from ml.features.splits import split_stratified_temporal, stratified_temporal_split


def _df(steps: list[int], labels: list[int]) -> pd.DataFrame:
    return pd.DataFrame({"step": steps, "isFraud": labels, "amount": [1.0] * len(steps)})


def test_each_split_contains_both_classes() -> None:
    df = _df(list(range(1, 101)), [0] * 90 + [1] * 10)
    train, val, test = split_stratified_temporal(df)
    assert train["isFraud"].sum() > 0
    assert val["isFraud"].sum() > 0
    assert test["isFraud"].sum() > 0


def test_within_class_chronology_is_preserved() -> None:
    df = _df(list(range(1, 201)), [0] * 100 + [1] * 100)
    train, val, test = split_stratified_temporal(df)
    for label in [0, 1]:
        max_train = train[train["isFraud"] == label]["step"].max()
        min_val = val[val["isFraud"] == label]["step"].min()
        max_val = val[val["isFraud"] == label]["step"].max()
        min_test = test[test["isFraud"] == label]["step"].min()
        assert max_train < min_val
        assert max_val < min_test


def test_fraud_rate_approximately_preserved() -> None:
    df = _df(list(range(1, 1001)), [0] * 990 + [1] * 10)
    train, val, test = split_stratified_temporal(df)
    base_rate = df["isFraud"].mean()
    for split in [train, val, test]:
        # Allow generous tolerance due to small numbers, but rate should be in the ballpark
        assert abs(split["isFraud"].mean() - base_rate) < 0.05


def test_all_rows_covered() -> None:
    df = _df(list(range(1, 101)), [0] * 90 + [1] * 10)
    train, val, test = split_stratified_temporal(df)
    assert len(train) + len(val) + len(test) == len(df)


def test_rejects_invalid_fractions() -> None:
    df = _df([1, 2, 3], [0, 1, 0])
    with pytest.raises(ValueError):
        stratified_temporal_split(df, train_frac=1.5)
    with pytest.raises(ValueError):
        stratified_temporal_split(df, train_frac=0.7, val_frac=0.5)