"""Model registry endpoints."""

from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends
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