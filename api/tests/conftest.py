"""Shared pytest fixtures for API tests.

Strategy: connect to sentinel_test (separate DB), run migrations once per
session, wrap each test in a transaction that rolls back at the end so tests
don't pollute each other.
"""

from __future__ import annotations

import os
from collections.abc import Generator

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

# Force test DB BEFORE any api imports load Settings
TEST_DB_URL = "postgresql+psycopg://sentinel:devpassword@localhost:5433/sentinel_test"
os.environ["DATABASE_URL"] = TEST_DB_URL

from api.db.database import get_db  # noqa: E402
from api.db.models import Tenant, User  # noqa: E402
from api.main import app  # noqa: E402
from api.services.security import hash_password  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def _migrate_once() -> None:
    """Run Alembic upgrade head once at session start."""
    cfg = Config("alembic.ini")
    cfg.set_main_option("sqlalchemy.url", TEST_DB_URL)
    command.upgrade(cfg, "head")


@pytest.fixture(scope="session")
def engine():
    return create_engine(TEST_DB_URL, pool_pre_ping=True)


@pytest.fixture
def db_session(engine) -> Generator[Session, None, None]:
    """Per-test session wrapped in a transaction that rolls back."""
    connection = engine.connect()
    trans = connection.begin()
    SessionLocal = sessionmaker(bind=connection, autoflush=False, autocommit=False)
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
        trans.rollback()
        connection.close()


@pytest.fixture
def client(db_session: Session) -> Generator[TestClient, None, None]:
    """TestClient with DB overridden to share the rolled-back session."""

    def _override_db() -> Generator[Session, None, None]:
        yield db_session

    app.dependency_overrides[get_db] = _override_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def seed_tenant_and_users(db_session: Session) -> dict:
    """Seed a tenant and three users; return their IDs."""
    tenant = Tenant(slug="test-bank", name="Test Bank")
    db_session.add(tenant)
    db_session.flush()

    users = {}
    for role, email in [
        ("admin", "admin@test.demo"),
        ("senior_analyst", "senior@test.demo"),
        ("analyst", "analyst@test.demo"),
    ]:
        u = User(
            tenant_id=tenant.id,
            email=email,
            password_hash=hash_password("testpass123"),
            full_name=role.title(),
            role=role,
        )
        db_session.add(u)
        db_session.flush()
        users[role] = {"id": u.id, "email": u.email}

    db_session.flush()
    return {"tenant_id": tenant.id, "tenant_slug": tenant.slug, "users": users}


@pytest.fixture
def auth_token(client: TestClient, seed_tenant_and_users: dict) -> str:
    """Logged-in analyst's JWT."""
    resp = client.post(
        "/auth/login",
        json={"email": "analyst@test.demo", "password": "testpass123"},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


@pytest.fixture
def auth_headers(auth_token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {auth_token}"}