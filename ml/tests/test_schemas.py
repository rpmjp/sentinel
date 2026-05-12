"""Tests for data validation schemas."""

from __future__ import annotations

import pandas as pd
import pandera.errors as pa_errors
import pytest

from ml.features.schemas import validate_raw


def _valid_row() -> dict[str, object]:
    return {
        "step": 1,
        "type": "TRANSFER",
        "amount": 100.0,
        "nameOrig": "C1234567",
        "oldbalanceOrg": 1000.0,
        "newbalanceOrig": 900.0,
        "nameDest": "C7654321",
        "oldbalanceDest": 0.0,
        "newbalanceDest": 100.0,
        "isFraud": 0,
        "isFlaggedFraud": 0,
    }


def test_validate_raw_accepts_valid_data() -> None:
    df = pd.DataFrame([_valid_row()])
    result = validate_raw(df)
    assert len(result) == 1


def test_validate_raw_rejects_invalid_txn_type() -> None:
    row = _valid_row()
    row["type"] = "INVALID_TYPE"
    df = pd.DataFrame([row])
    with pytest.raises(pa_errors.SchemaErrors):
        validate_raw(df)


def test_validate_raw_rejects_negative_amount() -> None:
    row = _valid_row()
    row["amount"] = -50.0
    df = pd.DataFrame([row])
    with pytest.raises(pa_errors.SchemaErrors):
        validate_raw(df)


def test_validate_raw_rejects_out_of_range_step() -> None:
    row = _valid_row()
    row["step"] = 9999
    df = pd.DataFrame([row])
    with pytest.raises(pa_errors.SchemaErrors):
        validate_raw(df)


def test_validate_raw_rejects_bad_isfraud_value() -> None:
    row = _valid_row()
    row["isFraud"] = 2
    df = pd.DataFrame([row])
    with pytest.raises(pa_errors.SchemaErrors):
        validate_raw(df)