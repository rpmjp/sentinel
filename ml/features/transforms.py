"""Per-row feature engineering.

These features are computed from a single transaction's columns —
no historical context required. Safe at train and serve time.
"""

from __future__ import annotations

import numpy as np
import pandas as pd


def add_row_features(df: pd.DataFrame) -> pd.DataFrame:
    """Add per-row engineered features. Returns a new DataFrame.

    Features added:
        - hour: hour of day (step % 24)
        - day: day index (step // 24)
        - is_weekend: bool, days 5-6 of week
        - is_fraud_prone_type: bool, TRANSFER or CASH_OUT
        - amount_log: log1p(amount), for skewed distribution
        - balance_drained: bool, sender balance ~= 0 after txn
        - drains_full_balance: bool, amount equals oldbalanceOrg (strong fraud signal)
        - receiver_was_empty: bool, oldbalanceDest == 0
        - amount_to_balance_ratio: amount / (oldbalanceOrg + 1)
    """
    out = df.copy()

    out["hour"] = out["step"] % 24
    out["day"] = out["step"] // 24
    out["is_weekend"] = (out["day"] % 7).isin([5, 6])

    out["amount_log"] = np.log1p(out["amount"])

    out["balance_drained"] = out["newbalanceOrig"] < 0.01
    out["drains_full_balance"] = np.isclose(out["amount"], out["oldbalanceOrg"], rtol=1e-3)
    out["receiver_was_empty"] = out["oldbalanceDest"] < 0.01

    out["amount_to_balance_ratio"] = out["amount"] / (out["oldbalanceOrg"] + 1.0)

    return out


# Columns to drop because they leak the target
LEAKAGE_COLUMNS = [
    "newbalanceOrig",   # post-transaction state
    "newbalanceDest",   # post-transaction state
    "isFlaggedFraud",   # system rule that encodes fraud
]


def drop_leakage(df: pd.DataFrame) -> pd.DataFrame:
    """Remove columns that leak the target. Returns a new DataFrame."""
    return df.drop(columns=[c for c in LEAKAGE_COLUMNS if c in df.columns])