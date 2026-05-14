"""Dashboard aggregate endpoints."""

from __future__ import annotations

from collections import defaultdict
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


class TimeseriesPoint(BaseModel):
    timestamp: str
    txn_count: int
    fraud_count: int
    blocked_amount: float
    avg_score: float


class HeatmapCell(BaseModel):
    day: int  # 0-6, Mon-Sun
    hour: int  # 0-23
    count: int
    fraud_rate: float


class TypeBreakdown(BaseModel):
    type: str
    high: int
    medium: int
    low: int


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

    n = len(rows)
    bucket_size = max(1, n // 20)
    return [
        float(sum(rows[i : i + bucket_size]) / max(len(rows[i : i + bucket_size]), 1))
        for i in range(0, n, bucket_size)
    ][:20]


@router.get("/timeseries", response_model=list[TimeseriesPoint])
async def timeseries(
    hours: int = 24,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(get_current_user),
) -> list[TimeseriesPoint]:
    """Per-hour aggregates over the last N hours."""
    cutoff = datetime.now(UTC) - timedelta(hours=hours)

    rows = db.execute(
        select(Transaction.received_at, Transaction.amount, Prediction.score)
        .join(Prediction, Prediction.transaction_id == Transaction.id)
        .where(
            Transaction.tenant_id == ctx.tenant_id,
            Transaction.received_at >= cutoff,
        )
    ).all()

    if not rows:
        # Return empty buckets so the chart still draws
        now = datetime.now(UTC)
        return [
            TimeseriesPoint(
                timestamp=(now - timedelta(hours=hours - i)).strftime("%H:%M"),
                txn_count=0, fraud_count=0, blocked_amount=0.0, avg_score=0.0,
            )
            for i in range(hours)
        ]

    buckets: dict[str, dict] = defaultdict(
        lambda: {"count": 0, "fraud": 0, "blocked": 0.0, "scores": []}
    )

    for received_at, amount, score in rows:
        key = received_at.strftime("%H:%M")
        b = buckets[key]
        b["count"] += 1
        b["scores"].append(score)
        if score >= HIGH_THRESHOLD:
            b["fraud"] += 1
            b["blocked"] += amount

    return [
        TimeseriesPoint(
            timestamp=k,
            txn_count=v["count"],
            fraud_count=v["fraud"],
            blocked_amount=v["blocked"],
            avg_score=sum(v["scores"]) / len(v["scores"]) if v["scores"] else 0.0,
        )
        for k, v in sorted(buckets.items())
    ]


@router.get("/heatmap", response_model=list[HeatmapCell])
async def heatmap(
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(get_current_user),
) -> list[HeatmapCell]:
    """Hour-of-day x day-of-week heatmap of transaction count + fraud rate."""
    rows = db.execute(
        select(Transaction.received_at, Prediction.score)
        .join(Prediction, Prediction.transaction_id == Transaction.id)
        .where(Transaction.tenant_id == ctx.tenant_id)
    ).all()

    cells: dict[tuple[int, int], dict] = defaultdict(lambda: {"count": 0, "fraud": 0})
    for received_at, score in rows:
        day = received_at.weekday()  # 0=Mon
        hour = received_at.hour
        cells[(day, hour)]["count"] += 1
        if score >= HIGH_THRESHOLD:
            cells[(day, hour)]["fraud"] += 1

    out: list[HeatmapCell] = []
    for day in range(7):
        for hour in range(24):
            c = cells.get((day, hour), {"count": 0, "fraud": 0})
            count = c["count"]
            fraud_rate = (c["fraud"] / count) if count else 0.0
            out.append(HeatmapCell(day=day, hour=hour, count=count, fraud_rate=fraud_rate))
    return out


@router.get("/type-breakdown", response_model=list[TypeBreakdown])
async def type_breakdown(
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(get_current_user),
) -> list[TypeBreakdown]:
    """Stacked-bar data: transaction count by type, stratified by risk band."""
    rows = db.execute(
        select(Transaction.type, Prediction.risk_band, func.count(Prediction.id))
        .join(Prediction, Prediction.transaction_id == Transaction.id)
        .where(Transaction.tenant_id == ctx.tenant_id)
        .group_by(Transaction.type, Prediction.risk_band)
    ).all()

    grouped: dict[str, dict[str, int]] = defaultdict(lambda: {"high": 0, "medium": 0, "low": 0})
    for txn_type, band, count in rows:
        grouped[txn_type][band] = int(count)

    return [
        TypeBreakdown(type=t, high=v["high"], medium=v["medium"], low=v["low"])
        for t, v in sorted(grouped.items())
    ]