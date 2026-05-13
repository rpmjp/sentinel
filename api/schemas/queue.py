"""Pydantic schemas for the analyst queue and feedback endpoints."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class QueueItem(BaseModel):
    transaction_id: uuid.UUID
    prediction_id: uuid.UUID
    score: float
    risk_band: str
    amount: float
    type: str
    name_orig: str
    name_dest: str
    scored_at: datetime
    decision: str | None = None  # None if no analyst decision yet


class QueueResponse(BaseModel):
    items: list[QueueItem]
    total: int
    page: int
    page_size: int


class TransactionDetail(BaseModel):
    transaction_id: uuid.UUID
    prediction_id: uuid.UUID
    step: int
    type: str
    amount: float
    name_orig: str
    old_balance_org: float
    name_dest: str
    old_balance_dest: float
    score: float
    risk_band: str
    threshold_at_scoring: float
    latency_ms: float
    explanation: dict
    received_at: datetime
    scored_at: datetime
    is_fraud: bool | None
    decision: str | None
    decision_notes: str | None
    decided_at: datetime | None


class FeedbackIn(BaseModel):
    decision: str = Field(description="confirmed_fraud | false_positive | escalated")
    notes: str | None = Field(default=None, max_length=2048)


class FeedbackOut(BaseModel):
    transaction_id: uuid.UUID
    decision: str
    decided_at: datetime