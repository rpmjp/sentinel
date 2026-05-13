"""Auth endpoint tests."""

from __future__ import annotations

from fastapi.testclient import TestClient


def test_login_with_valid_credentials_returns_token(
    client: TestClient, seed_tenant_and_users: dict
) -> None:
    resp = client.post(
        "/auth/login",
        json={"email": "analyst@test.demo", "password": "testpass123"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "access_token" in body
    assert body["token_type"] == "bearer"


def test_login_with_wrong_password_returns_401(
    client: TestClient, seed_tenant_and_users: dict
) -> None:
    resp = client.post(
        "/auth/login",
        json={"email": "analyst@test.demo", "password": "wrong"},
    )
    assert resp.status_code == 401


def test_login_with_unknown_email_returns_401(client: TestClient) -> None:
    resp = client.post(
        "/auth/login",
        json={"email": "nobody@test.demo", "password": "x"},
    )
    assert resp.status_code == 401


def test_me_returns_current_user(client: TestClient, auth_headers: dict) -> None:
    resp = client.get("/auth/me", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["email"] == "analyst@test.demo"
    assert body["role"] == "analyst"


def test_me_without_token_returns_401(client: TestClient) -> None:
    resp = client.get("/auth/me")
    assert resp.status_code == 401


def test_me_with_invalid_token_returns_401(client: TestClient) -> None:
    resp = client.get("/auth/me", headers={"Authorization": "Bearer not-a-real-jwt"})
    assert resp.status_code == 401