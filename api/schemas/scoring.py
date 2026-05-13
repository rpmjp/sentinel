"""Pydantic schemas for /score endpoints."""

from __future__ import annotations

import uuid

from pydantic import BaseModel, Field


class TransactionIn(BaseModel):
    """A single transaction to score. Matches the PaySim raw schema."""

    step: int = Field(ge=0, description="Hour index from simulation start")
    type: str = Field(description="CASH_IN | CASH_OUT | DEBIT | PAYMENT | TRANSFER")
    amount: float = Field(ge=0)
    nameOrig: str = Field(description="Sender ID")
    oldbalanceOrg: float = Field(ge=0)
    newbalanceOrig: float = Field(ge=0)
    nameDest: str = Field(description="Receiver ID")
    oldbalanceDest: float = Field(ge=0)
    newbalanceDest: float = Field(ge=0)


class TopFeatureOut(BaseModel):
    name: str
    value: float
    contribution: float


class ScoreOut(BaseModel):
    transaction_id: uuid.UUID
    prediction_id: uuid.UUID
    score: float = Field(description="Calibrated fraud probability [0, 1]")
    risk_band: str = Field(description="high | medium | low")
    threshold: float
    top_features: list[TopFeatureOut]
    latency_ms: float


class BatchScoreIn(BaseModel):
    transactions: list[TransactionIn] = Field(min_length=1, max_length=1000)


class BatchScoreOut(BaseModel):
    results: list[ScoreOut]
    total_latency_ms: float