"""Threshold tuner — exposes the precomputed val curves from training."""

from __future__ import annotations

import json
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from api.db.database import get_db
from api.db.models import ModelVersion
from api.services.auth import AuthContext, get_current_user

router = APIRouter(prefix="/tuner", tags=["tuner"])


class CostCurvePoint(BaseModel):
    threshold: float
    precision: float
    recall: float
    net_savings: float


class TunerResponse(BaseModel):
    model_name: str
    current_threshold: float
    cost_curve: list[CostCurvePoint]


@router.get("", response_model=TunerResponse)
async def get_tuner_data(
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(get_current_user),
) -> TunerResponse:
    mv = (
        db.query(ModelVersion)
        .filter(ModelVersion.tenant_id == ctx.tenant_id, ModelVersion.stage == "production")
        .one_or_none()
    )
    if mv is None:
        raise HTTPException(status_code=503, detail="No production model")

    curves_path = Path(mv.artifact_path).with_name(
        Path(mv.artifact_path).stem + "_val_curves.json"
    )
    if not curves_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Curve file not found at {curves_path}",
        )

    curves = json.loads(curves_path.read_text())
    return TunerResponse(
        model_name=mv.name,
        current_threshold=mv.threshold,
        cost_curve=[CostCurvePoint(**p) for p in curves["cost_curve"]],
    )