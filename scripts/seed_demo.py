"""Seed demo tenant, users, and a model_version row pointing at the trained artifact.

Idempotent: re-running won't create duplicates.

Demo accounts (all password 'demopass123'):
    admin@sentinel.demo        — admin
    senior@sentinel.demo       — senior_analyst
    analyst@sentinel.demo      — analyst

Usage:
    uv run python -m scripts.seed_demo
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

from sqlalchemy.orm import Session

from api.db.database import SessionLocal
from api.db.models import ModelVersion, Tenant, User
from api.services.security import hash_password

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

DEMO_TENANT_SLUG = "demo-bank-01"
DEMO_PASSWORD = "demopass123"

DEMO_USERS = [
    {"email": "admin@sentinel.demo", "full_name": "Alex Rivera", "role": "admin"},
    {"email": "senior@sentinel.demo", "full_name": "Maya Chen", "role": "senior_analyst"},
    {"email": "analyst@sentinel.demo", "full_name": "James Okafor", "role": "analyst"},
]


def seed(db: Session) -> None:
    tenant = db.query(Tenant).filter(Tenant.slug == DEMO_TENANT_SLUG).one_or_none()
    if tenant is None:
        tenant = Tenant(slug=DEMO_TENANT_SLUG, name="Demo Bank")
        db.add(tenant)
        db.flush()
        log.info("Created tenant %s", tenant.slug)
    else:
        log.info("Tenant %s exists", tenant.slug)

    for u in DEMO_USERS:
        existing = db.query(User).filter(User.email == u["email"]).one_or_none()
        if existing is not None:
            log.info("User %s exists", u["email"])
            continue
        db.add(
            User(
                tenant_id=tenant.id,
                email=u["email"],
                password_hash=hash_password(DEMO_PASSWORD),
                full_name=u["full_name"],
                role=u["role"],
            )
        )
        log.info("Created user %s (%s)", u["email"], u["role"])

    # Register the trained model artifact as the production model_version
    artifact_path = "models/lightgbm.joblib"
    metrics_path = Path("models/lightgbm_final_test_report.json")
    metrics: dict = {}
    if metrics_path.exists():
        metrics = json.loads(metrics_path.read_text())

    existing_mv = (
        db.query(ModelVersion)
        .filter(ModelVersion.tenant_id == tenant.id, ModelVersion.name == "sentinel-lightgbm")
        .one_or_none()
    )
    if existing_mv is None:
        db.add(
            ModelVersion(
                tenant_id=tenant.id,
                name="sentinel-lightgbm",
                version="0.1.0",
                artifact_path=artifact_path,
                stage="production",
                metrics=metrics,
                threshold=float(metrics.get("best_threshold", 0.5)),
            )
        )
        log.info("Created model_version sentinel-lightgbm v0.1.0 (production)")
    else:
        log.info("Model version sentinel-lightgbm exists")

    db.commit()


def main() -> None:
    db = SessionLocal()
    try:
        seed(db)
        log.info("Seed complete")
    finally:
        db.close()


if __name__ == "__main__":
    main()