"""Drift monitoring endpoints — compares recent feature distributions to a baseline."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import numpy as np
import pandas as pd
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from api.db.database import get_db
from api.db.models import Prediction, Transaction
from api.services.auth import AuthContext, get_current_user

router = APIRouter(prefix="/drift", tags=["drift"])

# PSI bins for continuous features
N_BINS = 10


class FeatureDrift(BaseModel):
    feature: str
    psi: float
    status: str  # stable | warning | alert
    baseline_mean: float
    recent_mean: float


class ScoreDistribution(BaseModel):
    bucket: str  # e.g., "0.0-0.1"
    baseline_count: int
    recent_count: int


class DriftResponse(BaseModel):
    overall_psi: float
    overall_status: str
    n_baseline: int
    n_recent: int
    features: list[FeatureDrift]
    score_distribution: list[ScoreDistribution]


def _psi(baseline: np.ndarray, recent: np.ndarray, n_bins: int = N_BINS) -> float:
    """Population Stability Index. <0.1 stable, 0.1-0.25 warning, >0.25 alert."""
    if len(baseline) == 0 or len(recent) == 0:
        return 0.0

    # Build bins from baseline percentiles, then count both populations
    bins = np.unique(np.percentile(baseline, np.linspace(0, 100, n_bins + 1)))
    if len(bins) < 2:
        return 0.0
    bins[0] = -np.inf
    bins[-1] = np.inf

    base_counts, _ = np.histogram(baseline, bins=bins)
    recent_counts, _ = np.histogram(recent, bins=bins)

    base_pct = (base_counts + 1) / (base_counts.sum() + len(base_counts))
    recent_pct = (recent_counts + 1) / (recent_counts.sum() + len(recent_counts))

    return float(np.sum((recent_pct - base_pct) * np.log(recent_pct / base_pct)))


def _status(psi: float) -> str:
    if psi < 0.1:
        return "stable"
    if psi < 0.25:
        return "warning"
    return "alert"


@router.get("", response_model=DriftResponse)
async def get_drift(
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(get_current_user),
) -> DriftResponse:
    """Compare last 7 days vs prior 7 days for the tenant."""
    now = datetime.now(UTC)
    recent_cutoff = now - timedelta(days=7)
    baseline_cutoff = now - timedelta(days=14)

    rows = db.execute(
        select(
            Transaction.amount,
            Transaction.old_balance_org,
            Transaction.old_balance_dest,
            Transaction.type,
            Prediction.score,
            Transaction.received_at,
        )
        .join(Prediction, Prediction.transaction_id == Transaction.id)
        .where(
            Transaction.tenant_id == ctx.tenant_id,
            Transaction.received_at >= baseline_cutoff,
        )
    ).all()

    if not rows:
        return DriftResponse(
            overall_psi=0.0,
            overall_status="stable",
            n_baseline=0,
            n_recent=0,
            features=[],
            score_distribution=[],
        )

    df = pd.DataFrame(rows, columns=["amount", "old_balance_org", "old_balance_dest", "type", "score", "received_at"])
    df["received_at"] = pd.to_datetime(df["received_at"], utc=True)
    baseline = df[df["received_at"] < recent_cutoff]
    recent = df[df["received_at"] >= recent_cutoff]

    # If one side is empty (likely in demo data), split current data 50/50 so the chart still renders
    if baseline.empty or recent.empty:
        midpoint = len(df) // 2
        baseline = df.iloc[:midpoint]
        recent = df.iloc[midpoint:]

    feature_drifts: list[FeatureDrift] = []
    for feat in ["amount", "old_balance_org", "old_balance_dest", "score"]:
        psi = _psi(baseline[feat].to_numpy(), recent[feat].to_numpy())
        feature_drifts.append(
            FeatureDrift(
                feature=feat,
                psi=psi,
                status=_status(psi),
                baseline_mean=float(baseline[feat].mean()),
                recent_mean=float(recent[feat].mean()),
            )
        )

    # Categorical PSI for transaction type
    base_types = baseline["type"].value_counts(normalize=True)
    rec_types = recent["type"].value_counts(normalize=True).reindex(base_types.index, fill_value=0)
    type_psi = float(np.sum((rec_types - base_types) * np.log((rec_types + 1e-6) / (base_types + 1e-6))))
    feature_drifts.append(
        FeatureDrift(
            feature="type",
            psi=type_psi,
            status=_status(type_psi),
            baseline_mean=0.0,
            recent_mean=0.0,
        )
    )

    overall_psi = float(np.mean([f.psi for f in feature_drifts]))

    # Score distribution histogram
    bins = np.linspace(0, 1, 11)
    base_hist, _ = np.histogram(baseline["score"], bins=bins)
    rec_hist, _ = np.histogram(recent["score"], bins=bins)
    distribution = [
        ScoreDistribution(
            bucket=f"{bins[i]:.1f}–{bins[i+1]:.1f}",
            baseline_count=int(base_hist[i]),
            recent_count=int(rec_hist[i]),
        )
        for i in range(len(bins) - 1)
    ]

    return DriftResponse(
        overall_psi=overall_psi,
        overall_status=_status(overall_psi),
        n_baseline=len(baseline),
        n_recent=len(recent),
        features=feature_drifts,
        score_distribution=distribution,
    )