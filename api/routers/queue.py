"""Queue and transaction-detail endpoints."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session, aliased

from api.db.database import get_db
from api.db.models import AnalystDecision, Prediction, Transaction
from api.schemas.queue import (
    FeedbackIn,
    FeedbackOut,
    QueueItem,
    QueueResponse,
    TransactionDetail,
)
from api.services.auth import AuthContext, get_current_user

router = APIRouter(tags=["queue"])

VALID_DECISIONS = {"confirmed_fraud", "false_positive", "escalated"}


@router.get("/queue", response_model=QueueResponse)
async def list_queue(
    risk: str | None = Query(default=None, description="high | medium | low"),
    decided: bool | None = Query(default=None, description="filter by has-decision"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(get_current_user),
) -> QueueResponse:
    """Paginated fraud queue, ordered by score desc."""
    decision_alias = aliased(AnalystDecision)

    base_q = (
        select(Transaction, Prediction, decision_alias.decision)
        .join(Prediction, Prediction.transaction_id == Transaction.id)
        .outerjoin(decision_alias, decision_alias.transaction_id == Transaction.id)
        .where(Transaction.tenant_id == ctx.tenant_id)
    )

    if risk is not None:
        base_q = base_q.where(Prediction.risk_band == risk)
    if decided is True:
        base_q = base_q.where(decision_alias.id.is_not(None))
    elif decided is False:
        base_q = base_q.where(decision_alias.id.is_(None))

    count_q = base_q.with_only_columns(Transaction.id).distinct()
    total = len(db.execute(count_q).scalars().all())

    items_q = (
        base_q.order_by(Prediction.score.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    rows = db.execute(items_q).all()

    items = [
        QueueItem(
            transaction_id=t.id,
            prediction_id=p.id,
            score=p.score,
            risk_band=p.risk_band,
            amount=t.amount,
            type=t.type,
            name_orig=t.name_orig,
            name_dest=t.name_dest,
            scored_at=p.scored_at,
            decision=d,
        )
        for t, p, d in rows
    ]

    return QueueResponse(items=items, total=total, page=page, page_size=page_size)


@router.get("/transactions/{transaction_id}", response_model=TransactionDetail)
async def get_transaction(
    transaction_id: uuid.UUID,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(get_current_user),
) -> TransactionDetail:
    txn = (
        db.query(Transaction)
        .filter(Transaction.id == transaction_id, Transaction.tenant_id == ctx.tenant_id)
        .one_or_none()
    )
    if txn is None:
        raise HTTPException(status_code=404, detail="Transaction not found")

    pred = (
        db.query(Prediction)
        .filter(Prediction.transaction_id == txn.id)
        .order_by(Prediction.scored_at.desc())
        .first()
    )
    if pred is None:
        raise HTTPException(status_code=500, detail="Transaction has no prediction")

    dec = (
        db.query(AnalystDecision)
        .filter(AnalystDecision.transaction_id == txn.id)
        .order_by(AnalystDecision.decided_at.desc())
        .first()
    )

    return TransactionDetail(
        transaction_id=txn.id,
        prediction_id=pred.id,
        step=txn.step,
        type=txn.type,
        amount=txn.amount,
        name_orig=txn.name_orig,
        old_balance_org=txn.old_balance_org,
        name_dest=txn.name_dest,
        old_balance_dest=txn.old_balance_dest,
        score=pred.score,
        risk_band=pred.risk_band,
        threshold_at_scoring=pred.threshold_at_scoring,
        latency_ms=pred.latency_ms,
        explanation=pred.explanation,
        received_at=txn.received_at,
        scored_at=pred.scored_at,
        is_fraud=txn.is_fraud,
        decision=dec.decision if dec else None,
        decision_notes=dec.notes if dec else None,
        decided_at=dec.decided_at if dec else None,
    )


@router.post(
    "/transactions/{transaction_id}/feedback",
    response_model=FeedbackOut,
    status_code=status.HTTP_201_CREATED,
)
async def submit_feedback(
    transaction_id: uuid.UUID,
    payload: FeedbackIn,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(get_current_user),
) -> FeedbackOut:
    if payload.decision not in VALID_DECISIONS:
        raise HTTPException(
            status_code=400,
            detail=f"decision must be one of: {sorted(VALID_DECISIONS)}",
        )

    txn = (
        db.query(Transaction)
        .filter(Transaction.id == transaction_id, Transaction.tenant_id == ctx.tenant_id)
        .one_or_none()
    )
    if txn is None:
        raise HTTPException(status_code=404, detail="Transaction not found")

    decision = AnalystDecision(
        tenant_id=ctx.tenant_id,
        transaction_id=txn.id,
        user_id=ctx.user_id,
        decision=payload.decision,
        notes=payload.notes,
    )
    db.add(decision)

    # Update the transaction's ground-truth label based on the decision
    if payload.decision == "confirmed_fraud":
        txn.is_fraud = True
    elif payload.decision == "false_positive":
        txn.is_fraud = False
    # "escalated" leaves is_fraud unchanged

    db.commit()
    db.refresh(decision)
    return FeedbackOut(
        transaction_id=txn.id,
        decision=decision.decision,
        decided_at=decision.decided_at,
    )