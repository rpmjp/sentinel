"""End-to-end tests for scoring, queue, detail, and feedback."""

from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from api.db.models import ModelVersion


FRAUD_TXN = {
    "step": 1,
    "type": "TRANSFER",
    "amount": 181000.0,
    "nameOrig": "C1666544",
    "oldbalanceOrg": 181000.0,
    "newbalanceOrig": 0.0,
    "nameDest": "C553264",
    "oldbalanceDest": 0.0,
    "newbalanceDest": 0.0,
}


@pytest.fixture
def seed_model_version(db_session: Session, seed_tenant_and_users: dict) -> ModelVersion:
    """A production model_version for the test tenant."""
    mv = ModelVersion(
        tenant_id=seed_tenant_and_users["tenant_id"],
        name="test-lightgbm",
        version="0.1.0",
        artifact_path="models/lightgbm.joblib",
        stage="production",
        metrics={"pr_auc": 0.992},
        threshold=0.01,
    )
    db_session.add(mv)
    db_session.flush()
    return mv


def test_score_persists_transaction_and_prediction(
    client: TestClient, auth_headers: dict, seed_model_version: ModelVersion
) -> None:
    resp = client.post("/score", headers=auth_headers, json=FRAUD_TXN)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["score"] > 0.9
    assert body["risk_band"] == "high"
    assert uuid.UUID(body["transaction_id"])
    assert uuid.UUID(body["prediction_id"])
    assert len(body["top_features"]) > 0


def test_score_without_auth_returns_401(client: TestClient) -> None:
    resp = client.post("/score", json=FRAUD_TXN)
    assert resp.status_code == 401


def test_score_without_model_returns_503(client: TestClient, auth_headers: dict) -> None:
    """No model_version seeded — endpoint should refuse."""
    resp = client.post("/score", headers=auth_headers, json=FRAUD_TXN)
    assert resp.status_code == 503


def test_queue_returns_scored_transactions(
    client: TestClient, auth_headers: dict, seed_model_version: ModelVersion
) -> None:
    client.post("/score", headers=auth_headers, json=FRAUD_TXN)
    resp = client.get("/queue", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] >= 1
    assert body["items"][0]["risk_band"] == "high"


def test_queue_filters_by_risk(
    client: TestClient, auth_headers: dict, seed_model_version: ModelVersion
) -> None:
    client.post("/score", headers=auth_headers, json=FRAUD_TXN)
    resp = client.get("/queue?risk=low", headers=auth_headers)
    assert resp.status_code == 200
    # The fraud txn we scored is risk=high, so risk=low should be empty
    assert resp.json()["total"] == 0


def test_transaction_detail_includes_explanation(
    client: TestClient, auth_headers: dict, seed_model_version: ModelVersion
) -> None:
    score_resp = client.post("/score", headers=auth_headers, json=FRAUD_TXN)
    txn_id = score_resp.json()["transaction_id"]

    resp = client.get(f"/transactions/{txn_id}", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["score"] > 0.9
    assert "top_features" in body["explanation"]
    assert len(body["explanation"]["top_features"]) > 0
    assert body["decision"] is None  # no feedback yet


def test_transaction_detail_unknown_id_returns_404(
    client: TestClient, auth_headers: dict
) -> None:
    resp = client.get(f"/transactions/{uuid.uuid4()}", headers=auth_headers)
    assert resp.status_code == 404


def test_feedback_updates_is_fraud_label(
    client: TestClient, auth_headers: dict, seed_model_version: ModelVersion
) -> None:
    score_resp = client.post("/score", headers=auth_headers, json=FRAUD_TXN)
    txn_id = score_resp.json()["transaction_id"]

    fb = client.post(
        f"/transactions/{txn_id}/feedback",
        headers=auth_headers,
        json={"decision": "confirmed_fraud", "notes": "test"},
    )
    assert fb.status_code == 201

    detail = client.get(f"/transactions/{txn_id}", headers=auth_headers).json()
    assert detail["is_fraud"] is True
    assert detail["decision"] == "confirmed_fraud"


def test_feedback_false_positive_marks_is_fraud_false(
    client: TestClient, auth_headers: dict, seed_model_version: ModelVersion
) -> None:
    score_resp = client.post("/score", headers=auth_headers, json=FRAUD_TXN)
    txn_id = score_resp.json()["transaction_id"]

    client.post(
        f"/transactions/{txn_id}/feedback",
        headers=auth_headers,
        json={"decision": "false_positive"},
    )
    detail = client.get(f"/transactions/{txn_id}", headers=auth_headers).json()
    assert detail["is_fraud"] is False


def test_feedback_invalid_decision_returns_400(
    client: TestClient, auth_headers: dict, seed_model_version: ModelVersion
) -> None:
    score_resp = client.post("/score", headers=auth_headers, json=FRAUD_TXN)
    txn_id = score_resp.json()["transaction_id"]

    resp = client.post(
        f"/transactions/{txn_id}/feedback",
        headers=auth_headers,
        json={"decision": "made_it_up"},
    )
    assert resp.status_code == 400