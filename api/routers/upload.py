"""CSV batch upload endpoints."""

from __future__ import annotations

import csv
import io
import time
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import ValidationError
from sqlalchemy.orm import Session

from api.db.database import get_db
from api.routers.scoring import _active_model_version, _persist
from api.schemas.scoring import TransactionIn
from api.services.auth import AuthContext, get_current_user
from api.services.model_service import ModelService, get_model_service

router = APIRouter(prefix="/upload", tags=["upload"])

MAX_ROWS = 10_000
MAX_UPLOAD_BYTES = 5 * 1024 * 1024
MAX_READ_BYTES = MAX_UPLOAD_BYTES + 1
ALLOWED_CONTENT_TYPES = {
    "text/csv",
    "application/csv",
    "application/vnd.ms-excel",
    "text/plain",
}
CHUNK_SIZE = 100
FORMULA_PREFIXES = ("=", "+", "-", "@")
TEXT_COLUMNS = {"type", "nameOrig", "nameDest"}

REQUIRED_COLUMNS = [
    "step",
    "type",
    "amount",
    "nameOrig",
    "oldbalanceOrg",
    "newbalanceOrig",
    "nameDest",
    "oldbalanceDest",
    "newbalanceDest",
]

COLUMN_ALIASES = {
    "name_orig": "nameOrig",
    "old_balance_org": "oldbalanceOrg",
    "new_balance_orig": "newbalanceOrig",
    "name_dest": "nameDest",
    "old_balance_dest": "oldbalanceDest",
    "new_balance_dest": "newbalanceDest",
}


def _normalize_row(row: dict[str, Any]) -> dict[str, Any]:
    normalized = dict(row)
    for src, dest in COLUMN_ALIASES.items():
        if dest not in normalized and src in normalized:
            normalized[dest] = normalized[src]
    for column in TEXT_COLUMNS:
        value = normalized.get(column)
        if isinstance(value, str):
            cleaned = value.replace("\x00", "")
            stripped = cleaned.lstrip()
            if stripped.startswith(FORMULA_PREFIXES):
                normalized[column] = f"'{stripped}"
            else:
                normalized[column] = cleaned
    return normalized


async def _read_limited(file: UploadFile) -> bytes:
    data = await file.read(MAX_READ_BYTES)
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"CSV exceeds {MAX_UPLOAD_BYTES // (1024 * 1024)} MB upload limit",
        )
    return data


def _parse_csv(contents: bytes) -> tuple[list[TransactionIn], list[dict[str, Any]]]:
    try:
        text = contents.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise HTTPException(status_code=400, detail="CSV must be UTF-8 encoded") from exc

    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        raise HTTPException(status_code=400, detail="CSV has no header row")

    normalized_headers = {COLUMN_ALIASES.get(h, h) for h in reader.fieldnames}
    missing = [column for column in REQUIRED_COLUMNS if column not in normalized_headers]
    if missing:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "CSV is missing required columns",
                "missing": missing,
                "required": REQUIRED_COLUMNS,
            },
        )

    transactions: list[TransactionIn] = []
    errors: list[dict[str, Any]] = []
    for index, raw in enumerate(reader, start=2):
        if len(transactions) >= MAX_ROWS:
            raise HTTPException(
                status_code=400,
                detail=f"CSV exceeds {MAX_ROWS:,} row upload cap",
            )
        try:
            transactions.append(TransactionIn.model_validate(_normalize_row(raw)))
        except ValidationError as exc:
            for err in exc.errors():
                field = ".".join(str(part) for part in err["loc"])
                errors.append({"row": index, "field": field, "message": err["msg"]})

    if not transactions and not errors:
        raise HTTPException(status_code=400, detail="CSV contains no transaction rows")
    return transactions, errors


@router.post("/transactions")
async def upload_transactions(
    file: UploadFile = File(...),
    svc: ModelService = Depends(get_model_service),
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(get_current_user),
) -> dict[str, Any]:
    if ctx.role not in {"senior_analyst", "admin"}:
        raise HTTPException(status_code=403, detail="senior analyst or admin role required")

    filename = file.filename or ""
    if not filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Upload must be a CSV file")
    if file.content_type and file.content_type.lower() not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail="Upload content type must be CSV")

    contents = await _read_limited(file)
    transactions, errors = _parse_csv(contents)
    if errors:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"message": "CSV validation failed", "errors": errors[:200]},
        )

    mv = _active_model_version(db, ctx.tenant_id)
    t0 = time.perf_counter()
    counts = {"high": 0, "medium": 0, "low": 0}
    scored_total = 0

    for start in range(0, len(transactions), CHUNK_SIZE):
        chunk = transactions[start : start + CHUNK_SIZE]
        scored = svc.score([txn.model_dump() for txn in chunk])
        for txn, score in zip(chunk, scored, strict=True):
            _persist(
                db,
                tenant_id=ctx.tenant_id,
                model_version_id=mv.id,
                txn_in=txn,
                scored=score,
            )
            counts[score.risk_band] += 1
            scored_total += 1
        db.flush()

    db.commit()
    total_ms = (time.perf_counter() - t0) * 1000
    return {
        "uploaded": len(transactions),
        "scored": scored_total,
        "high": counts["high"],
        "medium": counts["medium"],
        "low": counts["low"],
        "rejected": 0,
        "errors": [],
        "total_latency_ms": total_ms,
    }
