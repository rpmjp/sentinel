"""Cross-history search, bulk actions, CSV export, similar-transaction lookup."""

from __future__ import annotations

import csv
import io
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session, aliased

from api.db.database import get_db
from api.db.models import AnalystDecision, Prediction, Transaction
from api.services.auth import AuthContext, get_current_user

router = APIRouter(prefix="/investigate", tags=["investigate"])


class InvestigateItem(BaseModel):
    transaction_id: uuid.UUID
    score: float
    risk_band: str
    amount: float
    type: str
    name_orig: str
    name_dest: str
    scored_at: datetime
    decision: str | None


class InvestigateStats(BaseModel):
    total: int
    total_amount: float
    confirmed_fraud: int
    false_positives: int
    pending: int
    avg_score: float


class InvestigateResponse(BaseModel):
    items: list[InvestigateItem]
    total: int
    page: int
    page_size: int
    stats: InvestigateStats


class BulkActionPayload(BaseModel):
    transaction_ids: list[uuid.UUID]
    decision: str  # confirmed_fraud | false_positive | escalated
    notes: str | None = None


class BulkActionResponse(BaseModel):
    updated: int


def _filters(
    *,
    tenant_id: uuid.UUID,
    q: str | None,
    txn_type: str | None,
    risk: str | None,
    decision: str | None,
    min_amount: float | None,
    max_amount: float | None,
    min_score: float | None,
    max_score: float | None,
    decision_alias: any,
):
    conds = [Transaction.tenant_id == tenant_id]
    if q:
        like = f"%{q}%"
        conds.append(or_(Transaction.name_orig.ilike(like), Transaction.name_dest.ilike(like)))
    if txn_type:
        conds.append(Transaction.type == txn_type)
    if risk:
        conds.append(Prediction.risk_band == risk)
    if decision == "pending":
        conds.append(decision_alias.id.is_(None))
    elif decision in {"confirmed_fraud", "false_positive", "escalated"}:
        conds.append(decision_alias.decision == decision)
    if min_amount is not None:
        conds.append(Transaction.amount >= min_amount)
    if max_amount is not None:
        conds.append(Transaction.amount <= max_amount)
    if min_score is not None:
        conds.append(Prediction.score >= min_score)
    if max_score is not None:
        conds.append(Prediction.score <= max_score)
    return and_(*conds)


@router.get("", response_model=InvestigateResponse)
async def investigate(
    q: str | None = Query(None),
    txn_type: str | None = Query(None),
    risk: str | None = Query(None),
    decision: str | None = Query(None),
    min_amount: float | None = Query(None, ge=0),
    max_amount: float | None = Query(None, ge=0),
    min_score: float | None = Query(None, ge=0, le=1),
    max_score: float | None = Query(None, ge=0, le=1),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(get_current_user),
) -> InvestigateResponse:
    decision_alias = aliased(AnalystDecision)

    where = _filters(
        tenant_id=ctx.tenant_id, q=q, txn_type=txn_type, risk=risk, decision=decision,
        min_amount=min_amount, max_amount=max_amount, min_score=min_score, max_score=max_score,
        decision_alias=decision_alias,
    )

    base = (
        select(Transaction, Prediction, decision_alias.decision)
        .join(Prediction, Prediction.transaction_id == Transaction.id)
        .outerjoin(decision_alias, decision_alias.transaction_id == Transaction.id)
        .where(where)
    )

    # Stats
    stats_q = (
        select(
            func.count(Transaction.id),
            func.coalesce(func.sum(Transaction.amount), 0.0),
            func.coalesce(func.avg(Prediction.score), 0.0),
        )
        .select_from(Transaction)
        .join(Prediction, Prediction.transaction_id == Transaction.id)
        .outerjoin(decision_alias, decision_alias.transaction_id == Transaction.id)
        .where(where)
    )
    total_count, total_amount, avg_score = db.execute(stats_q).one()

    decision_counts = dict(
        db.execute(
            select(
                func.coalesce(decision_alias.decision, "pending"),
                func.count(Transaction.id),
            )
            .select_from(Transaction)
            .join(Prediction, Prediction.transaction_id == Transaction.id)
            .outerjoin(decision_alias, decision_alias.transaction_id == Transaction.id)
            .where(where)
            .group_by(decision_alias.decision)
        ).all()
    )
    n_fraud = decision_counts.get("confirmed_fraud", 0)
    n_fp = decision_counts.get("false_positive", 0)
    n_pending = decision_counts.get("pending", 0)

    rows = db.execute(
        base.order_by(Prediction.scored_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()

    items = [
        InvestigateItem(
            transaction_id=t.id, score=p.score, risk_band=p.risk_band,
            amount=t.amount, type=t.type, name_orig=t.name_orig, name_dest=t.name_dest,
            scored_at=p.scored_at, decision=d,
        )
        for t, p, d in rows
    ]
    return InvestigateResponse(
        items=items,
        total=int(total_count),
        page=page,
        page_size=page_size,
        stats=InvestigateStats(
            total=int(total_count),
            total_amount=float(total_amount),
            confirmed_fraud=int(n_fraud),
            false_positives=int(n_fp),
            pending=int(n_pending),
            avg_score=float(avg_score),
        ),
    )


@router.get("/export.csv")
async def export_csv(
    q: str | None = Query(None),
    txn_type: str | None = Query(None),
    risk: str | None = Query(None),
    decision: str | None = Query(None),
    min_amount: float | None = Query(None, ge=0),
    max_amount: float | None = Query(None, ge=0),
    min_score: float | None = Query(None, ge=0, le=1),
    max_score: float | None = Query(None, ge=0, le=1),
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(get_current_user),
) -> StreamingResponse:
    """Export current filter result set as CSV. Caps at 10K rows."""
    decision_alias = aliased(AnalystDecision)
    where = _filters(
        tenant_id=ctx.tenant_id, q=q, txn_type=txn_type, risk=risk, decision=decision,
        min_amount=min_amount, max_amount=max_amount, min_score=min_score, max_score=max_score,
        decision_alias=decision_alias,
    )

    rows = db.execute(
        select(Transaction, Prediction, decision_alias.decision)
        .join(Prediction, Prediction.transaction_id == Transaction.id)
        .outerjoin(decision_alias, decision_alias.transaction_id == Transaction.id)
        .where(where)
        .order_by(Prediction.scored_at.desc())
        .limit(10_000)
    ).all()

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([
        "transaction_id", "scored_at", "type", "amount",
        "name_orig", "name_dest", "score", "risk_band", "decision",
    ])
    for t, p, d in rows:
        writer.writerow([
            str(t.id), p.scored_at.isoformat(), t.type, f"{t.amount:.2f}",
            t.name_orig, t.name_dest, f"{p.score:.4f}", p.risk_band, d or "",
        ])

    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=sentinel_investigate_{datetime.utcnow():%Y%m%d_%H%M%S}.csv"},
    )


@router.post("/bulk", response_model=BulkActionResponse)
async def bulk_action(
    payload: BulkActionPayload,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(get_current_user),
) -> BulkActionResponse:
    if payload.decision not in {"confirmed_fraud", "false_positive", "escalated"}:
        raise HTTPException(status_code=400, detail="invalid decision")

    updated = 0
    for txn_id in payload.transaction_ids:
        txn = db.query(Transaction).filter(
            Transaction.id == txn_id, Transaction.tenant_id == ctx.tenant_id
        ).one_or_none()
        if txn is None:
            continue
        db.add(AnalystDecision(
            tenant_id=ctx.tenant_id,
            transaction_id=txn.id,
            user_id=ctx.user_id,
            decision=payload.decision,
            notes=payload.notes,
        ))
        if payload.decision == "confirmed_fraud":
            txn.is_fraud = True
        elif payload.decision == "false_positive":
            txn.is_fraud = False
        updated += 1

    db.commit()
    return BulkActionResponse(updated=updated)


@router.get("/similar/{transaction_id}", response_model=list[InvestigateItem])
async def similar_transactions(
    transaction_id: uuid.UUID,
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(get_current_user),
) -> list[InvestigateItem]:
    """Find transactions structurally similar to a given one.

    Similar = same type, similar amount band (within 50%), same risk band.
    """
    base_txn = db.query(Transaction).filter(
        Transaction.id == transaction_id, Transaction.tenant_id == ctx.tenant_id
    ).one_or_none()
    if base_txn is None:
        raise HTTPException(status_code=404, detail="transaction not found")

    base_pred = db.query(Prediction).filter(
        Prediction.transaction_id == base_txn.id
    ).order_by(Prediction.scored_at.desc()).first()
    if base_pred is None:
        return []

    decision_alias = aliased(AnalystDecision)
    rows = db.execute(
        select(Transaction, Prediction, decision_alias.decision)
        .join(Prediction, Prediction.transaction_id == Transaction.id)
        .outerjoin(decision_alias, decision_alias.transaction_id == Transaction.id)
        .where(and_(
            Transaction.tenant_id == ctx.tenant_id,
            Transaction.id != base_txn.id,
            Transaction.type == base_txn.type,
            Prediction.risk_band == base_pred.risk_band,
            Transaction.amount >= base_txn.amount * 0.5,
            Transaction.amount <= base_txn.amount * 1.5,
        ))
        .order_by(func.abs(Prediction.score - base_pred.score).asc())
        .limit(limit)
    ).all()

    return [
        InvestigateItem(
            transaction_id=t.id, score=p.score, risk_band=p.risk_band,
            amount=t.amount, type=t.type, name_orig=t.name_orig, name_dest=t.name_dest,
            scored_at=p.scored_at, decision=d,
        )
        for t, p, d in rows
    ]