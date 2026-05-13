"""Tests for sender historical aggregates.

The critical test: no future leakage. Each row's aggregates must depend
only on rows with smaller step values for the same sender.
"""

from __future__ import annotations

import pandas as pd

from ml.features.aggregates import compute_sender_aggregates
from ml.features.aggregates import compute_receiver_aggregates



def test_first_txn_has_no_prior_history() -> None:
    df = pd.DataFrame(
        {
            "step": [1, 2, 3],
            "nameOrig": ["C1", "C1", "C1"],
            "amount": [100.0, 200.0, 300.0],
        }
    )
    result = compute_sender_aggregates(df)
    first = result[result["step"] == 1].iloc[0]
    assert first["sender_txn_count_prior"] == 0
    assert first["sender_amount_mean_prior"] == 0.0
    assert first["sender_amount_max_prior"] == 0.0


def test_aggregates_only_see_past_rows() -> None:
    df = pd.DataFrame(
        {
            "step": [1, 2, 3, 4],
            "nameOrig": ["C1", "C1", "C1", "C1"],
            "amount": [100.0, 200.0, 300.0, 400.0],
        }
    )
    result = compute_sender_aggregates(df).sort_values("step")

    # Step 1: no prior
    assert result.iloc[0]["sender_txn_count_prior"] == 0
    # Step 2: one prior (100)
    assert result.iloc[1]["sender_txn_count_prior"] == 1
    assert result.iloc[1]["sender_amount_mean_prior"] == 100.0
    # Step 3: two priors (100, 200)
    assert result.iloc[2]["sender_txn_count_prior"] == 2
    assert result.iloc[2]["sender_amount_mean_prior"] == 150.0
    assert result.iloc[2]["sender_amount_max_prior"] == 200.0
    # Step 4: three priors (100, 200, 300)
    assert result.iloc[3]["sender_txn_count_prior"] == 3
    assert result.iloc[3]["sender_amount_mean_prior"] == 200.0
    assert result.iloc[3]["sender_amount_max_prior"] == 300.0


def test_different_senders_have_independent_aggregates() -> None:
    df = pd.DataFrame(
        {
            "step": [1, 2, 1, 2],
            "nameOrig": ["C1", "C1", "C2", "C2"],
            "amount": [100.0, 200.0, 500.0, 600.0],
        }
    )
    result = compute_sender_aggregates(df)

    c1_step2 = result[(result["nameOrig"] == "C1") & (result["step"] == 2)].iloc[0]
    c2_step2 = result[(result["nameOrig"] == "C2") & (result["step"] == 2)].iloc[0]

    assert c1_step2["sender_amount_mean_prior"] == 100.0
    assert c2_step2["sender_amount_mean_prior"] == 500.0


def test_preserves_original_row_count() -> None:
    df = pd.DataFrame(
        {
            "step": [1, 2, 3, 4, 5],
            "nameOrig": ["C1", "C2", "C1", "C2", "C3"],
            "amount": [100.0, 200.0, 300.0, 400.0, 500.0],
        }
    )
    result = compute_sender_aggregates(df)
    assert len(result) == 5

def test_receiver_aggregates_only_see_past_rows() -> None:
    df = pd.DataFrame(
        {
            "step": [1, 2, 3, 4],
            "nameOrig": ["C1", "C2", "C3", "C4"],
            "nameDest": ["D1", "D1", "D1", "D1"],
            "amount": [100.0, 200.0, 300.0, 400.0],
        }
    )
    result = compute_receiver_aggregates(df).sort_values("step")
    assert result.iloc[0]["receiver_txn_count_prior"] == 0
    assert result.iloc[1]["receiver_txn_count_prior"] == 1
    assert result.iloc[1]["receiver_amount_mean_prior"] == 100.0
    assert result.iloc[2]["receiver_unique_senders_prior"] == 2
    assert result.iloc[3]["receiver_unique_senders_prior"] == 3