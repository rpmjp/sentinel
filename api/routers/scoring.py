"""Scoring endpoints: /score (single) and /score/batch.

Now tenant-aware: every score persists a Transaction + Prediction row,
which the queue and feedback endpoints can then operate on.
"""

from __future__ import annotations

import time
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from api.db.database import get_db
from api.db.models import ModelVersion, Prediction, Transaction
from api.schemas.scoring import (
    BatchScoreIn,
    BatchScoreOut,
    ScoreOut,
    TopFeatureOut,
    TransactionIn,
)
from api.services.auth import AuthContext, get_current_user
from api.services.model_service import ModelService, ScoredTransaction, get_model_service

router = APIRouter(prefix="/score", tags=["scoring"])


def _to_out(scored: ScoredTransaction, *, transaction_id: uuid.UUID, prediction_id: uuid.UUID) -> ScoreOut:
    return ScoreOut(
        transaction_id=transaction_id,
        prediction_id=prediction_id,
        score=scored.score,
        risk_band=scored.risk_band,
        threshold=scored.threshold,
        top_features=[
            TopFeatureOut(name=f.name, value=f.value, contribution=f.contribution)
            for f in scored.top_features
        ],
        latency_ms=scored.latency_ms,
    )


def _active_model_version(db: Session, tenant_id: uuid.UUID) -> ModelVersion:
    mv = (
        db.query(ModelVersion)
        .filter(ModelVersion.tenant_id == tenant_id, ModelVersion.stage == "production")
        .order_by(ModelVersion.created_at.desc())
        .first()
    )
    if mv is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="No production model registered for this tenant",
        )
    return mv


def _persist(
    db: Session,
    *,
    tenant_id: uuid.UUID,
    model_version_id: uuid.UUID,
    txn_in: TransactionIn,
    scored: ScoredTransaction,
) -> tuple[uuid.UUID, uuid.UUID]:
    txn = Transaction(
        tenant_id=tenant_id,
        step=txn_in.step,
        type=txn_in.type,
        amount=txn_in.amount,
        name_orig=txn_in.nameOrig,
        old_balance_org=txn_in.oldbalanceOrg,
        name_dest=txn_in.nameDest,
        old_balance_dest=txn_in.oldbalanceDest,
    )
    db.add(txn)
    db.flush()

    pred = Prediction(
        tenant_id=tenant_id,
        transaction_id=txn.id,
        model_version_id=model_version_id,
        score=scored.score,
        risk_band=scored.risk_band,
        threshold_at_scoring=scored.threshold,
        explanation={
            "top_features": [
                {"name": f.name, "value": f.value, "contribution": f.contribution}
                for f in scored.top_features
            ],
        },
        latency_ms=scored.latency_ms,
    )
    db.add(pred)
    db.flush()
    return txn.id, pred.id


@router.post("", response_model=ScoreOut)
async def score_single(
    txn: TransactionIn,
    svc: ModelService = Depends(get_model_service),
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(get_current_user),
) -> ScoreOut:
    """Score a single transaction; persist Transaction + Prediction; return score + SHAP."""
    mv = _active_model_version(db, ctx.tenant_id)
    scored = svc.score([txn.model_dump()])[0]
    txn_id, pred_id = _persist(
        db, tenant_id=ctx.tenant_id, model_version_id=mv.id, txn_in=txn, scored=scored
    )
    db.commit()
    return _to_out(scored, transaction_id=txn_id, prediction_id=pred_id)


@router.post("/batch", response_model=BatchScoreOut)
async def score_batch(
    payload: BatchScoreIn,
    svc: ModelService = Depends(get_model_service),
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(get_current_user),
) -> BatchScoreOut:
    """Score up to 1000 transactions, persist all, return results."""
    mv = _active_model_version(db, ctx.tenant_id)
    t0 = time.perf_counter()
    scored_list = svc.score([t.model_dump() for t in payload.transactions])

    outs: list[ScoreOut] = []
    for txn_in, scored in zip(payload.transactions, scored_list, strict=True):
        txn_id, pred_id = _persist(
            db, tenant_id=ctx.tenant_id, model_version_id=mv.id, txn_in=txn_in, scored=scored
        )
        outs.append(_to_out(scored, transaction_id=txn_id, prediction_id=pred_id))

    db.commit()
    total_ms = (time.perf_counter() - t0) * 1000
    return BatchScoreOut(results=outs, total_latency_ms=total_ms)