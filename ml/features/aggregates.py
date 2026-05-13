"""Sender historical aggregates — computed only from past transactions.

This is the leakage fix from the original notebook, which computed
sender_avg_amount and sender_txn_count on the full dataset, contaminating
the test set with statistics from future rows.

At training time: we sort by step and compute rolling/expanding aggregates
that only see strictly past rows.

At serve time: these would be looked up from a feature store. Phase 2
implements a simple Postgres-backed version.
"""

from __future__ import annotations

import pandas as pd


def compute_sender_aggregates(df: pd.DataFrame) -> pd.DataFrame:
    """Compute historical aggregates per sender using only past rows.

    Sorts by (nameOrig, step), then for each row computes statistics
    over all that sender's prior transactions. Row 0 for a sender has
    NaN aggregates (no history yet), filled with sensible defaults.

    Args:
        df: must contain nameOrig, step, amount.

    Returns:
        New DataFrame with added columns:
            - sender_txn_count_prior: int, count of prior txns
            - sender_amount_mean_prior: float, mean amount of prior txns
            - sender_amount_max_prior: float, max amount of prior txns
            - sender_amount_std_prior: float, std of prior amounts (0 if <2 prior)
    """
    out = df.sort_values(["nameOrig", "step"]).copy()

    grp = out.groupby("nameOrig", sort=False)["amount"]
    # shift(1) before expanding so each row sees only strictly past rows
    shifted = grp.shift(1)
    expanding = shifted.groupby(out["nameOrig"], sort=False).expanding()

    out["sender_txn_count_prior"] = expanding.count().reset_index(level=0, drop=True)
    out["sender_amount_mean_prior"] = expanding.mean().reset_index(level=0, drop=True)
    out["sender_amount_max_prior"] = expanding.max().reset_index(level=0, drop=True)
    out["sender_amount_std_prior"] = expanding.std().reset_index(level=0, drop=True)

    # First txn for a sender has no history — fill with neutral values
    out["sender_txn_count_prior"] = out["sender_txn_count_prior"].fillna(0).astype(int)
    out["sender_amount_mean_prior"] = out["sender_amount_mean_prior"].fillna(0.0)
    out["sender_amount_max_prior"] = out["sender_amount_max_prior"].fillna(0.0)
    out["sender_amount_std_prior"] = out["sender_amount_std_prior"].fillna(0.0)

    return out.sort_index()

def compute_receiver_aggregates(df: pd.DataFrame) -> pd.DataFrame:
    """Historical aggregates per receiver using only past rows.

    In PaySim and real-world fraud, receivers (cashout accounts) are reused
    across fraud rings far more than senders. This often carries stronger
    signal than sender aggregates.

    Args:
        df: must contain nameDest, step, amount.

    Returns:
        New DataFrame with added columns:
            - receiver_txn_count_prior: int
            - receiver_amount_mean_prior: float
            - receiver_amount_max_prior: float
            - receiver_unique_senders_prior: int (count of distinct prior senders)
    """
    out = df.sort_values(["nameDest", "step"]).copy()

    grp_amt = out.groupby("nameDest", sort=False)["amount"]
    shifted = grp_amt.shift(1)
    expanding = shifted.groupby(out["nameDest"], sort=False).expanding()

    out["receiver_txn_count_prior"] = expanding.count().reset_index(level=0, drop=True)
    out["receiver_amount_mean_prior"] = expanding.mean().reset_index(level=0, drop=True)
    out["receiver_amount_max_prior"] = expanding.max().reset_index(level=0, drop=True)

    # Count of distinct prior senders per receiver.
    # Approach: factorize sender ids to integer codes, then for each
    # (nameDest, sender_code) mark the FIRST occurrence with 1 else 0,
    # shift by 1 within nameDest, and cumsum. That gives the count of
    # distinct senders seen STRICTLY before each row.
    out["_sender_code"] = pd.factorize(out["nameOrig"])[0]
    first_seen = ~out.duplicated(subset=["nameDest", "_sender_code"], keep="first")
    first_seen_int = first_seen.astype(int)
    out["receiver_unique_senders_prior"] = (
        first_seen_int.groupby(out["nameDest"], sort=False)
        .shift(1)
        .fillna(0)
        .groupby(out["nameDest"], sort=False)
        .cumsum()
        .astype(int)
    )
    out = out.drop(columns=["_sender_code"])

    out["receiver_txn_count_prior"] = out["receiver_txn_count_prior"].fillna(0).astype(int)
    out["receiver_amount_mean_prior"] = out["receiver_amount_mean_prior"].fillna(0.0)
    out["receiver_amount_max_prior"] = out["receiver_amount_max_prior"].fillna(0.0)
    out["receiver_unique_senders_prior"] = out["receiver_unique_senders_prior"].fillna(0).astype(int)

    return out.sort_index()