"""Scoring endpoints: /score (single) and /score/batch."""

from __future__ import annotations

import time

from fastapi import APIRouter, Depends

from api.schemas.scoring import (
    BatchScoreIn,
    BatchScoreOut,
    ScoreOut,
    TopFeatureOut,
    TransactionIn,
)
from api.services.model_service import ModelService, get_model_service

router = APIRouter(prefix="/score", tags=["scoring"])


def _to_out(scored) -> ScoreOut:  # type: ignore[no-untyped-def]
    return ScoreOut(
        score=scored.score,
        risk_band=scored.risk_band,
        threshold=scored.threshold,
        top_features=[
            TopFeatureOut(name=f.name, value=f.value, contribution=f.contribution)
            for f in scored.top_features
        ],
        latency_ms=scored.latency_ms,
    )


@router.post("", response_model=ScoreOut)
async def score_single(
    txn: TransactionIn,
    svc: ModelService = Depends(get_model_service),
) -> ScoreOut:
    """Score a single transaction. Returns risk band + SHAP top features."""
    results = svc.score([txn.model_dump()])
    return _to_out(results[0])


@router.post("/batch", response_model=BatchScoreOut)
async def score_batch(
    payload: BatchScoreIn,
    svc: ModelService = Depends(get_model_service),
) -> BatchScoreOut:
    """Score up to 1000 transactions in one call."""
    t0 = time.perf_counter()
    results = svc.score([t.model_dump() for t in payload.transactions])
    total_ms = (time.perf_counter() - t0) * 1000
    return BatchScoreOut(
        results=[_to_out(r) for r in results],
        total_latency_ms=total_ms,
    )