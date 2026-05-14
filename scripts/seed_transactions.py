"""Seed a realistic set of scored transactions for demoing the dashboard.

Pulls 25,000 rows from PaySim (mostly legit + some fraud), scores each through
the same model service the API uses, and persists Transaction + Prediction
rows for the demo tenant.

Idempotent: skips if there are already > 100 transactions for the tenant.

Usage:
    uv run python -m scripts.seed_transactions
"""

from __future__ import annotations

import logging
import random
from pathlib import Path

import pandas as pd
from sqlalchemy.orm import Session

from api.db.database import SessionLocal
from api.db.models import Case, CaseEntity, CaseNote, CaseTransaction, ModelVersion, Prediction, Tenant, Transaction, User
from api.services.model_service import ModelService

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

DATA_PATH = Path("data/raw/paysim.csv")
DEMO_TENANT_SLUG = "demo-bank-01"
SAMPLE_SIZE = 25000
FRAUD_FRACTION = 0.25  # punch up the fraud rate so the dashboard isn't boring


def seed(db: Session) -> None:
    tenant = db.query(Tenant).filter(Tenant.slug == DEMO_TENANT_SLUG).one_or_none()
    if tenant is None:
        raise RuntimeError("Demo tenant not found. Run 'make seed' first.")

    existing_count = (
        db.query(Transaction).filter(Transaction.tenant_id == tenant.id).count()
    )
    if existing_count > 100:
        log.info("Tenant already has %d transactions; skipping.", existing_count)
        seed_narrative_case(db, tenant)
        return

    mv = (
        db.query(ModelVersion)
        .filter(ModelVersion.tenant_id == tenant.id, ModelVersion.stage == "production")
        .one_or_none()
    )
    if mv is None:
        raise RuntimeError("No production model_version. Run 'make seed' first.")

    log.info("Loading model service")
    svc = ModelService(model_path=mv.artifact_path)
    svc.load()

    log.info("Sampling %d transactions from PaySim", SAMPLE_SIZE)
    raw = pd.read_csv(DATA_PATH)
    n_fraud = int(SAMPLE_SIZE * FRAUD_FRACTION)
    n_legit = SAMPLE_SIZE - n_fraud
    fraud_sample = raw[raw["isFraud"] == 1].sample(n=n_fraud, random_state=42)
    legit_sample = raw[raw["isFraud"] == 0].sample(n=n_legit, random_state=42)
    sample = pd.concat([fraud_sample, legit_sample]).sample(frac=1, random_state=42)

    rows = sample.to_dict(orient="records")
    log.info("Scoring %d transactions", len(rows))
    scored = svc.score(rows)

    log.info("Persisting Transaction + Prediction rows")
    rng = random.Random(42)
    for r, s in zip(rows, scored, strict=True):
        txn = Transaction(
            tenant_id=tenant.id,
            step=int(r["step"]),
            type=str(r["type"]),
            amount=float(r["amount"]),
            name_orig=str(r["nameOrig"]),
            old_balance_org=float(r["oldbalanceOrg"]),
            name_dest=str(r["nameDest"]),
            old_balance_dest=float(r["oldbalanceDest"]),
        )
        db.add(txn)
        db.flush()
        pred = Prediction(
            tenant_id=tenant.id,
            transaction_id=txn.id,
            model_version_id=mv.id,
            score=s.score,
            risk_band=s.risk_band,
            threshold_at_scoring=s.threshold,
            explanation={
                "top_features": [
                    {"name": f.name, "value": f.value, "contribution": f.contribution}
                    for f in s.top_features
                ],
            },
            latency_ms=s.latency_ms + rng.uniform(-2, 2),
        )
        db.add(pred)

    db.commit()
    log.info("Seeded %d transactions", len(rows))
    seed_narrative_case(db, tenant)


def seed_narrative_case(db: Session, tenant: Tenant) -> None:
    existing_case = db.query(Case).filter(Case.tenant_id == tenant.id).first()
    if existing_case is not None:
        log.info("Tenant already has case data; skipping narrative case.")
        return

    owner = (
        db.query(User)
        .filter(User.tenant_id == tenant.id, User.role.in_(["senior_analyst", "admin"]))
        .order_by(User.role.desc())
        .first()
    )
    if owner is None:
        owner = db.query(User).filter(User.tenant_id == tenant.id).first()
    if owner is None:
        log.warning("No demo user found; skipping narrative case.")
        return

    rows = (
        db.query(Transaction)
        .join(Prediction, Prediction.transaction_id == Transaction.id)
        .filter(Transaction.tenant_id == tenant.id, Prediction.risk_band == "high")
        .order_by(Prediction.score.desc())
        .limit(5)
        .all()
    )
    if not rows:
        log.warning("No high-risk transactions found; skipping narrative case.")
        return

    primary = rows[0]
    case = Case(
        tenant_id=tenant.id,
        title=f"Coordinated cash-out review: {primary.name_orig}",
        description=(
            "Demo narrative: a high-risk origin account shows large transfer/cash-out "
            "behavior and repeated exposure to risky counterparties."
        ),
        status="investigating",
        priority="critical",
        assigned_to=owner.id,
        created_by=owner.id,
    )
    db.add(case)
    db.flush()

    accounts: set[str] = set()
    for txn in rows:
        db.add(CaseTransaction(case_id=case.id, transaction_id=txn.id))
        accounts.add(txn.name_orig)
        accounts.add(txn.name_dest)

    for account_id in sorted(accounts)[:8]:
        db.add(CaseEntity(case_id=case.id, account_id=account_id, role="related"))

    db.add(
        CaseNote(
            case_id=case.id,
            user_id=owner.id,
            content="Seeded demo case: linked top high-risk transfers for an end-to-end investigation walkthrough.",
        )
    )
    db.commit()
    log.info("Seeded narrative case %s", case.id)


def main() -> None:
    db = SessionLocal()
    try:
        seed(db)
    finally:
        db.close()


if __name__ == "__main__":
    main()
