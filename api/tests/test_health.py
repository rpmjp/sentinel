"""Health endpoint tests."""

from __future__ import annotations

from fastapi.testclient import TestClient


def test_health_returns_200(client: TestClient) -> None:
    resp = client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"


def test_ready_returns_db_check(client: TestClient) -> None:
    resp = client.get("/ready")
    assert resp.status_code == 200
    body = resp.json()
    assert body["checks"]["database"] == "ok"


def test_root_returns_metadata(client: TestClient) -> None:
    resp = client.get("/")
    assert resp.status_code == 200
    assert resp.json()["name"] == "Sentinel"