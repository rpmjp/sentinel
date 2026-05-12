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