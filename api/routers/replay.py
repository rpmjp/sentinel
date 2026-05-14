"""Streaming replay engine.

POST /replay/start to begin scoring synthetic transactions at a configurable
rate. The dashboard's live ticker reads this stream. Stops automatically
after `duration_seconds`, or on POST /replay/stop.
"""

from __future__ import annotations

import asyncio
import logging
import random
import uuid
from datetime import UTC, datetime

import pandas as pd
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from api.config import get_settings
from api.db.database import SessionLocal, get_db
from api.db.models import ModelVersion, Prediction, Transaction
from api.services.auth import AuthContext, get_current_user
from api.services.model_service import ModelService

router = APIRouter(prefix="/replay", tags=["replay"])
log = logging.getLogger("sentinel.replay")
settings = get_settings()

# In-memory state per tenant
_replay_state: dict[uuid.UUID, dict] = {}


class ReplayStartRequest(BaseModel):
    rate_per_second: int = 5
    duration_seconds: int = 60
    fraud_fraction: float = 0.15


class ReplayStatus(BaseModel):
    running: bool
    transactions_replayed: int
    fraud_detected: int
    started_at: str | None
    rate_per_second: int | None
    elapsed_seconds: float | None


def _load_sample_transactions(n: int = 2000) -> list[dict]:
    """Load a small in-memory pool to replay from."""
    df = pd.read_csv("data/raw/paysim.csv", nrows=200_000)
    legit = df[df["isFraud"] == 0].sample(n=int(n * 0.85), random_state=42)
    fraud = df[df["isFraud"] == 1].sample(
        n=min(int(n * 0.15), int(df["isFraud"].sum())), random_state=42,
    )
    return pd.concat([legit, fraud]).sample(frac=1, random_state=42).to_dict(orient="records")


async def _run_replay(
    tenant_id: uuid.UUID,
    model_path: str,
    model_version_id: uuid.UUID,
    rate: int,
    duration: int,
    fraud_fraction: float,
) -> None:
    """Background task: continuously score random transactions until stopped."""
    state = _replay_state[tenant_id]
    interval = 1.0 / max(rate, 1)
    pool = _load_sample_transactions()
    fraud_pool = [r for r in pool if r["isFraud"] == 1]
    legit_pool = [r for r in pool if r["isFraud"] == 0]
    rng = random.Random()

    svc = ModelService(model_path=model_path)
    svc.load()
    log.info("Replay started for tenant %s @ %d/sec for %ds", tenant_id, rate, duration)

    start = datetime.now(UTC)
    state["started_at"] = start.isoformat()

    try:
        while state.get("running", False):
            elapsed = (datetime.now(UTC) - start).total_seconds()
            if elapsed >= duration:
                break

            is_fraud = rng.random() < fraud_fraction
            sample = rng.choice(fraud_pool if (is_fraud and fraud_pool) else legit_pool)

            scored = svc.score([sample])[0]

            # Persist within a fresh session per write (so the ticker sees them)
            db = SessionLocal()
            try:
                txn = Transaction(
                    tenant_id=tenant_id,
                    step=int(sample["step"]),
                    type=str(sample["type"]),
                    amount=float(sample["amount"]),
                    name_orig=str(sample["nameOrig"]),
                    old_balance_org=float(sample["oldbalanceOrg"]),
                    name_dest=str(sample["nameDest"]),
                    old_balance_dest=float(sample["oldbalanceDest"]),
                )
                db.add(txn)
                db.flush()
                db.add(Prediction(
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
                ))
                db.commit()

                state["transactions_replayed"] += 1
                if scored.risk_band == "high":
                    state["fraud_detected"] += 1
            finally:
                db.close()

            await asyncio.sleep(interval)
    finally:
        state["running"] = False
        log.info(
            "Replay stopped for tenant %s. %d transactions, %d high-risk.",
            tenant_id,
            state.get("transactions_replayed", 0),
            state.get("fraud_detected", 0),
        )


@router.post("/start", response_model=ReplayStatus)
async def start_replay(
    payload: ReplayStartRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(get_current_user),
) -> ReplayStatus:
    existing = _replay_state.get(ctx.tenant_id)
    if existing and existing.get("running"):
        raise HTTPException(status_code=409, detail="Replay already running")

    mv = (
        db.query(ModelVersion)
        .filter(ModelVersion.tenant_id == ctx.tenant_id, ModelVersion.stage == "production")
        .one_or_none()
    )
    if mv is None:
        raise HTTPException(status_code=503, detail="No production model")

    _replay_state[ctx.tenant_id] = {
        "running": True,
        "transactions_replayed": 0,
        "fraud_detected": 0,
        "started_at": None,
        "rate_per_second": payload.rate_per_second,
    }

    background_tasks.add_task(
        _run_replay,
        ctx.tenant_id,
        mv.artifact_path,
        mv.id,
        payload.rate_per_second,
        payload.duration_seconds,
        payload.fraud_fraction,
    )

    return ReplayStatus(
        running=True, transactions_replayed=0, fraud_detected=0,
        started_at=None, rate_per_second=payload.rate_per_second,
        elapsed_seconds=0,
    )


@router.post("/stop", response_model=ReplayStatus)
async def stop_replay(ctx: AuthContext = Depends(get_current_user)) -> ReplayStatus:
    state = _replay_state.get(ctx.tenant_id, {})
    state["running"] = False
    return _status(state)


@router.get("/status", response_model=ReplayStatus)
async def replay_status(ctx: AuthContext = Depends(get_current_user)) -> ReplayStatus:
    state = _replay_state.get(ctx.tenant_id, {})
    return _status(state)


def _status(state: dict) -> ReplayStatus:
    started = state.get("started_at")
    elapsed = None
    if started:
        elapsed = (datetime.now(UTC) - datetime.fromisoformat(started)).total_seconds()
    return ReplayStatus(
        running=bool(state.get("running", False)),
        transactions_replayed=int(state.get("transactions_replayed", 0)),
        fraud_detected=int(state.get("fraud_detected", 0)),
        started_at=started,
        rate_per_second=state.get("rate_per_second"),
        elapsed_seconds=elapsed,
    )