"""Entity profile and graph endpoints."""

from __future__ import annotations

from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session, aliased

from api.db.database import get_db
from api.db.models import AnalystDecision, Prediction, Transaction, WatchlistEntry
from api.routers.dashboard import HIGH_THRESHOLD
from api.services.auth import AuthContext, get_current_user

router = APIRouter(prefix="/entities", tags=["entities"])


class EntitySummary(BaseModel):
    account_id: str
    total_transactions: int
    sent_count: int
    received_count: int
    total_amount: float
    high_risk_count: int
    confirmed_fraud_count: int
    avg_score: float
    first_seen: str | None
    last_seen: str | None
    watchlist: str | None


class EntityTransaction(BaseModel):
    transaction_id: str
    direction: str
    counterparty: str
    type: str
    amount: float
    score: float
    risk_band: str
    scored_at: str
    decision: str | None


class EntityTrendPoint(BaseModel):
    bucket: str
    txn_count: int
    high_risk_count: int
    avg_score: float


class EntityGraphNode(BaseModel):
    id: str
    label: str
    role: str
    risk_score: float
    amount: float


class EntityGraphEdge(BaseModel):
    source: str
    target: str
    count: int
    amount: float


class EntityProfile(BaseModel):
    summary: EntitySummary
    transactions: list[EntityTransaction]
    trend: list[EntityTrendPoint]
    graph: dict[str, list[EntityGraphNode] | list[EntityGraphEdge]]


@router.get("/{account_id}", response_model=EntityProfile)
async def entity_profile(
    account_id: str,
    limit: int = Query(25, ge=1, le=100),
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(get_current_user),
) -> EntityProfile:
    decision_alias = aliased(AnalystDecision)
    rows = db.execute(
        select(Transaction, Prediction, decision_alias.decision)
        .join(Prediction, Prediction.transaction_id == Transaction.id)
        .outerjoin(decision_alias, decision_alias.transaction_id == Transaction.id)
        .where(
            Transaction.tenant_id == ctx.tenant_id,
            or_(Transaction.name_orig == account_id, Transaction.name_dest == account_id),
        )
        .order_by(Prediction.scored_at.desc())
        .limit(limit)
    ).all()

    if not rows:
        raise HTTPException(status_code=404, detail="entity not found")

    all_rows = db.execute(
        select(Transaction, Prediction, decision_alias.decision)
        .join(Prediction, Prediction.transaction_id == Transaction.id)
        .outerjoin(decision_alias, decision_alias.transaction_id == Transaction.id)
        .where(
            Transaction.tenant_id == ctx.tenant_id,
            or_(Transaction.name_orig == account_id, Transaction.name_dest == account_id),
        )
    ).all()

    watch = db.execute(
        select(WatchlistEntry.list_type).where(
            WatchlistEntry.tenant_id == ctx.tenant_id,
            WatchlistEntry.account_id == account_id,
        )
    ).scalars().first()

    total_amount = sum(float(t.amount) for t, _, _ in all_rows)
    scores = [float(p.score) for _, p, _ in all_rows]
    sent = sum(1 for t, _, _ in all_rows if t.name_orig == account_id)
    received = len(all_rows) - sent
    high = sum(1 for _, p, _ in all_rows if p.score >= HIGH_THRESHOLD)
    fraud = sum(1 for _, _, d in all_rows if d == "confirmed_fraud")
    dates = [p.scored_at for _, p, _ in all_rows]

    trend_buckets: dict[str, dict] = defaultdict(lambda: {"count": 0, "high": 0, "scores": []})
    counterparties: dict[str, dict] = defaultdict(lambda: {"count": 0, "amount": 0.0, "max_score": 0.0})
    edges: dict[tuple[str, str], dict] = defaultdict(lambda: {"count": 0, "amount": 0.0})

    txns: list[EntityTransaction] = []
    for txn, pred, decision in rows:
        is_sender = txn.name_orig == account_id
        counterparty = txn.name_dest if is_sender else txn.name_orig
        txns.append(
            EntityTransaction(
                transaction_id=str(txn.id),
                direction="sent" if is_sender else "received",
                counterparty=counterparty,
                type=txn.type,
                amount=float(txn.amount),
                score=float(pred.score),
                risk_band=pred.risk_band,
                scored_at=pred.scored_at.isoformat(),
                decision=decision,
            )
        )

    for txn, pred, _ in all_rows:
        bucket = pred.scored_at.strftime("%m-%d")
        trend_buckets[bucket]["count"] += 1
        trend_buckets[bucket]["scores"].append(float(pred.score))
        if pred.score >= HIGH_THRESHOLD:
            trend_buckets[bucket]["high"] += 1

        is_sender = txn.name_orig == account_id
        counterparty = txn.name_dest if is_sender else txn.name_orig
        counterparties[counterparty]["count"] += 1
        counterparties[counterparty]["amount"] += float(txn.amount)
        counterparties[counterparty]["max_score"] = max(counterparties[counterparty]["max_score"], float(pred.score))
        source, target = (account_id, counterparty) if is_sender else (counterparty, account_id)
        edges[(source, target)]["count"] += 1
        edges[(source, target)]["amount"] += float(txn.amount)

    top_counterparties = sorted(
        counterparties.items(),
        key=lambda item: (item[1]["max_score"], item[1]["amount"]),
        reverse=True,
    )[:12]
    keep_ids = {account_id, *[cp for cp, _ in top_counterparties]}

    nodes = [
        EntityGraphNode(
            id=account_id,
            label=account_id,
            role="entity",
            risk_score=max(scores) if scores else 0.0,
            amount=total_amount,
        )
    ]
    nodes.extend(
        EntityGraphNode(
            id=cp,
            label=cp,
            role="counterparty",
            risk_score=float(stats["max_score"]),
            amount=float(stats["amount"]),
        )
        for cp, stats in top_counterparties
    )

    graph_edges = [
        EntityGraphEdge(source=source, target=target, count=int(stats["count"]), amount=float(stats["amount"]))
        for (source, target), stats in edges.items()
        if source in keep_ids and target in keep_ids
    ]

    trend = [
        EntityTrendPoint(
            bucket=bucket,
            txn_count=int(stats["count"]),
            high_risk_count=int(stats["high"]),
            avg_score=sum(stats["scores"]) / len(stats["scores"]) if stats["scores"] else 0.0,
        )
        for bucket, stats in sorted(trend_buckets.items())
    ]

    return EntityProfile(
        summary=EntitySummary(
            account_id=account_id,
            total_transactions=len(all_rows),
            sent_count=sent,
            received_count=received,
            total_amount=total_amount,
            high_risk_count=high,
            confirmed_fraud_count=fraud,
            avg_score=sum(scores) / len(scores) if scores else 0.0,
            first_seen=min(dates).isoformat() if dates else None,
            last_seen=max(dates).isoformat() if dates else None,
            watchlist=watch,
        ),
        transactions=txns,
        trend=trend,
        graph={"nodes": nodes, "edges": graph_edges},
    )
