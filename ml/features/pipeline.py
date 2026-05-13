"""End-to-end data preparation pipeline.

Takes raw PaySim, returns (X_train, y_train, X_val, y_val, X_test, y_test).
Applies in order:
  1. Validate raw schema
  2. Compute temporal sender aggregates (no leakage — uses only past rows)
  3. Add per-row features
  4. Drop leakage columns
  5. Temporal split
  6. Encode categorical 'type' column
"""

from __future__ import annotations

from dataclasses import dataclass

import pandas as pd

from ml.features.aggregates import compute_receiver_aggregates, compute_sender_aggregates
from ml.features.schemas import validate_raw
from ml.features.splits import split_stratified
from ml.features.transforms import add_row_features, drop_leakage

TARGET = "isFraud"

# Columns dropped before training because they're not predictive in PaySim
# (random IDs) or already encoded via engineered features
DROP_BEFORE_TRAIN = ["nameOrig", "nameDest", "step"]

# Categorical columns to one-hot encode
CATEGORICAL = ["type"]


@dataclass
class PreparedData:
    X_train: pd.DataFrame
    y_train: pd.Series
    X_val: pd.DataFrame
    y_val: pd.Series
    X_test: pd.DataFrame
    y_test: pd.Series
    feature_names: list[str]


def prepare(
    raw: pd.DataFrame,
    train_frac: float = 0.70,
    val_frac: float = 0.15,
    use_aggregates: bool = False,
) -> PreparedData:
    """Run the full data prep pipeline.

    Args:
        use_aggregates: include sender/receiver historical aggregates.
            Set False for leakage ablation studies.
    """
    raw = validate_raw(raw)

    if use_aggregates:
        # Temporal aggregates (need nameOrig/nameDest + step)
        df = compute_sender_aggregates(raw)
        df = compute_receiver_aggregates(df)
    else:
        df = raw.copy()

    # Per-row features
    df = add_row_features(df)

    # Drop leakage columns
    df = drop_leakage(df)

    # Stratified random split. See ml/features/splits.py for rationale.
    train, val, test = split_stratified(df, train_frac=train_frac, val_frac=val_frac)

    # One-hot encode categorical columns. Fit on train only.
    train_encoded = pd.get_dummies(train, columns=CATEGORICAL, dtype=float)
    val_encoded = pd.get_dummies(val, columns=CATEGORICAL, dtype=float)
    test_encoded = pd.get_dummies(test, columns=CATEGORICAL, dtype=float)

    # Align val/test columns to train (handles unseen categories)
    val_encoded = val_encoded.reindex(columns=train_encoded.columns, fill_value=0.0)
    test_encoded = test_encoded.reindex(columns=train_encoded.columns, fill_value=0.0)

    # Drop columns we don't want as features
    drop_cols = [c for c in DROP_BEFORE_TRAIN if c in train_encoded.columns]
    X_train = train_encoded.drop(columns=[*drop_cols, TARGET])
    X_val = val_encoded.drop(columns=[*drop_cols, TARGET])
    X_test = test_encoded.drop(columns=[*drop_cols, TARGET])

    y_train = train_encoded[TARGET].astype(int)
    y_val = val_encoded[TARGET].astype(int)
    y_test = test_encoded[TARGET].astype(int)

    return PreparedData(
        X_train=X_train,
        y_train=y_train,
        X_val=X_val,
        y_val=y_val,
        X_test=X_test,
        y_test=y_test,
        feature_names=list(X_train.columns),
    )