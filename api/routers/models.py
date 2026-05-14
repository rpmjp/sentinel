"""Model registry endpoints."""

from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from api.db.database import get_db
from api.db.models import ModelVersion
from api.services.auth import AuthContext, get_current_user

router = APIRouter(prefix="/models", tags=["models"])


class ModelVersionOut(BaseModel):
    id: uuid.UUID
    name: str
    version: str
    stage: str
    metrics: dict
    git_sha: str | None
    threshold: float
    created_at: datetime
    activated_at: datetime | None


class ThresholdUpdate(BaseModel):
    threshold: float


@router.get("", response_model=list[ModelVersionOut])
async def list_models(
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(get_current_user),
) -> list[ModelVersionOut]:
    rows = (
        db.query(ModelVersion)
        .filter(ModelVersion.tenant_id == ctx.tenant_id)
        .order_by(ModelVersion.created_at.desc())
        .all()
    )
    return [
        ModelVersionOut(
            id=r.id,
            name=r.name,
            version=r.version,
            stage=r.stage,
            metrics=r.metrics or {},
            git_sha=r.git_sha,
            threshold=r.threshold,
            created_at=r.created_at,
            activated_at=r.activated_at,
        )
        for r in rows
    ]


@router.patch("/{model_id}/threshold", response_model=ModelVersionOut)
async def update_threshold(
    model_id: uuid.UUID,
    payload: ThresholdUpdate,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(get_current_user),
) -> ModelVersionOut:
    if ctx.role != "admin":
        raise HTTPException(status_code=403, detail="admin only")
    if not 0.0 < payload.threshold < 1.0:
        raise HTTPException(status_code=400, detail="threshold must be in (0, 1)")

    mv = (
        db.query(ModelVersion)
        .filter(ModelVersion.id == model_id, ModelVersion.tenant_id == ctx.tenant_id)
        .one_or_none()
    )
    if mv is None:
        raise HTTPException(status_code=404, detail="model not found")

    mv.threshold = payload.threshold
    db.commit()
    db.refresh(mv)
    return ModelVersionOut(
        id=mv.id,
        name=mv.name,
        version=mv.version,
        stage=mv.stage,
        metrics=mv.metrics or {},
        git_sha=mv.git_sha,
        threshold=mv.threshold,
        created_at=mv.created_at,
        activated_at=mv.activated_at,
    )