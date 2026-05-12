"""Pandera schemas for input data validation.

Catches schema drift before training: missing columns, wrong dtypes,
out-of-range values, unexpected categories.
"""

from __future__ import annotations

import pandas as pd
import pandera.pandas as pa
from pandera.typing.pandas import Series

VALID_TXN_TYPES = ["CASH_IN", "CASH_OUT", "DEBIT", "PAYMENT", "TRANSFER"]


class PaySimRawSchema(pa.DataFrameModel):
    """Schema for raw PaySim CSV as downloaded from Kaggle."""

    step: Series[int] = pa.Field(ge=1, le=744)
    type: Series[str] = pa.Field(isin=VALID_TXN_TYPES)
    amount: Series[float] = pa.Field(ge=0)
    nameOrig: Series[str] = pa.Field(str_startswith="C")
    oldbalanceOrg: Series[float] = pa.Field(ge=0)
    newbalanceOrig: Series[float] = pa.Field(ge=0)
    nameDest: Series[str] = pa.Field(str_matches=r"^[CM]")
    oldbalanceDest: Series[float] = pa.Field(ge=0)
    newbalanceDest: Series[float] = pa.Field(ge=0)
    isFraud: Series[int] = pa.Field(isin=[0, 1])
    isFlaggedFraud: Series[int] = pa.Field(isin=[0, 1])

    class Config:
        strict = True
        coerce = True


def validate_raw(df: pd.DataFrame) -> pd.DataFrame:
    """Validate a raw PaySim DataFrame. Raises pa.errors.SchemaError on failure."""
    return PaySimRawSchema.validate(df, lazy=True)