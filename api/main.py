"""Sentinel FastAPI application entrypoint.

Run locally with:
    make serve
or:
    uv run uvicorn api.main:app --reload --port 8000
"""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.config import get_settings
from api.routers import auth, dashboard, drift, health, queue, scoring, tuner

settings = get_settings()

logging.basicConfig(
    level=settings.log_level,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
log = logging.getLogger("sentinel.api")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Startup/shutdown hooks."""
    from api.services.model_service import init_model_service

    log.info("Sentinel API starting (env=%s)", settings.env)
    init_model_service(model_path=settings.model_path)
    log.info("Model service initialized")
    yield
    log.info("Sentinel API stopping")


app = FastAPI(
    title="Sentinel",
    description="Production-grade fraud detection platform.",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# CORS — wide open for dev. Tighten in Phase 4 deploy.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(scoring.router)
app.include_router(queue.router)
app.include_router(dashboard.router)
app.include_router(tuner.router)
app.include_router(drift.router)


@app.get("/", include_in_schema=False)
async def root() -> dict[str, str]:
    return {
        "name": "Sentinel",
        "version": app.version,
        "docs": "/docs",
    }