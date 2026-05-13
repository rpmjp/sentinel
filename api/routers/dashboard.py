"""Dashboard aggregate endpoints."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from api.db.database import get_db
from api.db.models import AnalystDecision, Prediction, Transaction
from api.services.auth import AuthContext, get_current_user

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

HIGH_THRESHOLD = 0.50


class KpiResponse(BaseModel):
    open_cases: int
    blocked_amount_24h: float
    txn_count_24h: int
    avg_score_24h: float
    high_risk_24h: int
    medium_risk_24h: int
    low_risk_24h: int


class SeriesPoint(BaseModel):
    label: str
    value: float


class TrendResponse(BaseModel):
    fraud_rate: list[SeriesPoint]
    blocked_amount: list[SeriesPoint]
    false_positive_rate: list[SeriesPoint]


@router.get("/kpis", response_model=KpiResponse)
async def kpis(
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(get_current_user),
) -> KpiResponse:
    cutoff = datetime.now(UTC) - timedelta(hours=24)

    open_cases = db.execute(
        select(func.count(Transaction.id))
        .join(Prediction, Prediction.transaction_id == Transaction.id)
        .outerjoin(AnalystDecision, AnalystDecision.transaction_id == Transaction.id)
        .where(
            Transaction.tenant_id == ctx.tenant_id,
            Prediction.score >= HIGH_THRESHOLD,
            AnalystDecision.id.is_(None),
        )
    ).scalar_one()

    blocked_amount = db.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0.0))
        .join(Prediction, Prediction.transaction_id == Transaction.id)
        .where(
            Transaction.tenant_id == ctx.tenant_id,
            Prediction.score >= HIGH_THRESHOLD,
            Transaction.received_at >= cutoff,
        )
    ).scalar_one()

    txn_count = db.execute(
        select(func.count(Transaction.id)).where(
            Transaction.tenant_id == ctx.tenant_id,
            Transaction.received_at >= cutoff,
        )
    ).scalar_one()

    avg_score = db.execute(
        select(func.coalesce(func.avg(Prediction.score), 0.0))
        .join(Transaction, Transaction.id == Prediction.transaction_id)
        .where(
            Transaction.tenant_id == ctx.tenant_id,
            Prediction.scored_at >= cutoff,
        )
    ).scalar_one()

    bands = dict(
        db.execute(
            select(Prediction.risk_band, func.count(Prediction.id))
            .join(Transaction, Transaction.id == Prediction.transaction_id)
            .where(
                Transaction.tenant_id == ctx.tenant_id,
                Prediction.scored_at >= cutoff,
            )
            .group_by(Prediction.risk_band)
        ).all()
    )

    return KpiResponse(
        open_cases=int(open_cases),
        blocked_amount_24h=float(blocked_amount),
        txn_count_24h=int(txn_count),
        avg_score_24h=float(avg_score),
        high_risk_24h=int(bands.get("high", 0)),
        medium_risk_24h=int(bands.get("medium", 0)),
        low_risk_24h=int(bands.get("low", 0)),
    )


@router.get("/sparkline", response_model=list[float])
async def sparkline_scores(
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(get_current_user),
) -> list[float]:
    """Returns last 20 risk-band counts in chronological buckets, for sparklines."""
    cutoff = datetime.now(UTC) - timedelta(hours=24)
    rows = db.execute(
        select(Prediction.score)
        .join(Transaction, Transaction.id == Prediction.transaction_id)
        .where(
            Transaction.tenant_id == ctx.tenant_id,
            Prediction.scored_at >= cutoff,
        )
        .order_by(Prediction.scored_at)
    ).scalars().all()

    if not rows:
        return [0.0]

    # Bucket into 20 evenly-sized chunks
    n = len(rows)
    bucket_size = max(1, n // 20)
    return [
        float(sum(rows[i : i + bucket_size]) / max(len(rows[i : i + bucket_size]), 1))
        for i in range(0, n, bucket_size)
    ][:20]