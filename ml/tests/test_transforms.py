"""Tests for per-row feature transforms."""

from __future__ import annotations

import numpy as np
import pandas as pd

from ml.features.transforms import (
    LEAKAGE_COLUMNS,
    add_row_features,
    drop_leakage,
)


def _sample_df() -> pd.DataFrame:
    return pd.DataFrame(
        {
            "step": [1, 25, 169, 720],  # hours: 1, 1, 1, 0; days: 0, 1, 7, 30
            "type": ["TRANSFER", "PAYMENT", "CASH_OUT", "CASH_IN"],
            "amount": [100.0, 50.0, 1000.0, 200.0],
            "nameOrig": ["C1", "C2", "C3", "C4"],
            "oldbalanceOrg": [100.0, 500.0, 1000.0, 0.0],
            "newbalanceOrig": [0.0, 450.0, 0.0, 200.0],
            "nameDest": ["C5", "M6", "C7", "C8"],
            "oldbalanceDest": [0.0, 100.0, 5000.0, 1000.0],
            "newbalanceDest": [100.0, 150.0, 6000.0, 800.0],
            "isFraud": [1, 0, 1, 0],
            "isFlaggedFraud": [0, 0, 0, 0],
        }
    )


def test_add_row_features_creates_expected_columns() -> None:
    result = add_row_features(_sample_df())
    expected = {
        "hour", "day", "is_weekend", "is_fraud_prone_type",
        "amount_log", "balance_drained", "drains_full_balance",
        "receiver_was_empty", "amount_to_balance_ratio",
    }
    assert expected.issubset(result.columns)


def test_drains_full_balance_flags_fraud_pattern() -> None:
    result = add_row_features(_sample_df())
    # Row 0: amount=100, oldbalanceOrg=100 → drains full balance
    # Row 2: amount=1000, oldbalanceOrg=1000 → drains full balance
    assert bool(result.loc[0, "drains_full_balance"])
    assert bool(result.loc[2, "drains_full_balance"])
    # Row 1: amount=50, oldbalanceOrg=500 → does not drain
    assert not bool(result.loc[1, "drains_full_balance"])


def test_is_fraud_prone_type_only_true_for_transfer_and_cashout() -> None:
    result = add_row_features(_sample_df())
    assert bool(result.loc[0, "is_fraud_prone_type"])   # TRANSFER
    assert not bool(result.loc[1, "is_fraud_prone_type"])  # PAYMENT
    assert bool(result.loc[2, "is_fraud_prone_type"])   # CASH_OUT
    assert not bool(result.loc[3, "is_fraud_prone_type"])  # CASH_IN


def test_amount_log_is_log1p() -> None:
    result = add_row_features(_sample_df())
    np.testing.assert_allclose(result["amount_log"].iloc[0], np.log1p(100.0))


def test_drop_leakage_removes_all_leakage_columns() -> None:
    result = drop_leakage(_sample_df())
    for col in LEAKAGE_COLUMNS:
        assert col not in result.columns


def test_drop_leakage_keeps_other_columns() -> None:
    result = drop_leakage(_sample_df())
    assert "amount" in result.columns
    assert "isFraud" in result.columns