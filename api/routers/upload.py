"""CSV batch upload endpoints."""

from __future__ import annotations

import csv
import io
import time
import uuid
from collections import defaultdict, deque
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import ValidationError
from sqlalchemy.orm import Session

from api.db.database import get_db
from api.db.models import UploadAudit
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
RATE_LIMIT_PER_MINUTE = 3
RATE_LIMIT_PER_HOUR = 20
CHUNK_SIZE = 100
FORMULA_PREFIXES = ("=", "+", "-", "@")
TEXT_COLUMNS = {"type", "nameOrig", "nameDest"}
_upload_attempts: defaultdict[tuple[uuid.UUID, uuid.UUID], deque[float]] = defaultdict(deque)

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


def _check_rate_limit(ctx: AuthContext) -> None:
    now = time.monotonic()
    window_start = now - 3600
    key = (ctx.tenant_id, ctx.user_id)
    attempts = _upload_attempts[key]
    while attempts and attempts[0] < window_start:
        attempts.popleft()

    minute_count = sum(1 for ts in attempts if ts >= now - 60)
    if minute_count >= RATE_LIMIT_PER_MINUTE or len(attempts) >= RATE_LIMIT_PER_HOUR:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Upload rate limit exceeded. Please wait before trying again.",
        )
    attempts.append(now)


async def _read_limited(file: UploadFile) -> bytes:
    data = await file.read(MAX_READ_BYTES)
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"CSV exceeds {MAX_UPLOAD_BYTES // (1024 * 1024)} MB upload limit",
        )
    return data


def _error_message(detail: Any) -> str:
    if isinstance(detail, str):
        return detail
    if isinstance(detail, dict):
        message = detail.get("message")
        if isinstance(message, str):
            return message
    return "Upload failed"


def _record_upload_audit(
    db: Session,
    *,
    ctx: AuthContext,
    filename: str,
    content_type: str | None,
    file_size_bytes: int,
    status_value: str,
    rows_uploaded: int = 0,
    rows_scored: int = 0,
    high_count: int = 0,
    medium_count: int = 0,
    low_count: int = 0,
    error_message: str | None = None,
) -> UploadAudit:
    audit = UploadAudit(
        tenant_id=ctx.tenant_id,
        user_id=ctx.user_id,
        filename=filename[:256] or "unknown.csv",
        content_type=(content_type or "")[:128] or None,
        file_size_bytes=file_size_bytes,
        status=status_value,
        rows_uploaded=rows_uploaded,
        rows_scored=rows_scored,
        high_count=high_count,
        medium_count=medium_count,
        low_count=low_count,
        error_message=error_message,
    )
    db.add(audit)
    return audit


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
    filename = file.filename or ""
    content_type = file.content_type
    if ctx.role not in {"senior_analyst", "admin"}:
        raise HTTPException(status_code=403, detail="senior analyst or admin role required")

    try:
        _check_rate_limit(ctx)
        if not filename.lower().endswith(".csv"):
            raise HTTPException(status_code=400, detail="Upload must be a CSV file")
        if content_type and content_type.lower() not in ALLOWED_CONTENT_TYPES:
            raise HTTPException(status_code=400, detail="Upload content type must be CSV")

        contents = await _read_limited(file)
        transactions, errors = _parse_csv(contents)
        if errors:
            _record_upload_audit(
                db,
                ctx=ctx,
                filename=filename,
                content_type=content_type,
                file_size_bytes=len(contents),
                status_value="failed",
                error_message=f"CSV validation failed ({len(errors)} row errors)",
            )
            db.commit()
            exc = HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"message": "CSV validation failed", "errors": errors[:200]},
            )
            setattr(exc, "_upload_audited", True)
            raise exc
    except HTTPException as exc:
        if exc.status_code != status.HTTP_403_FORBIDDEN and not getattr(exc, "_upload_audited", False):
            _record_upload_audit(
                db,
                ctx=ctx,
                filename=filename,
                content_type=content_type,
                file_size_bytes=0,
                status_value="rejected",
                error_message=_error_message(exc.detail),
            )
            db.commit()
        raise

    mv = _active_model_version(db, ctx.tenant_id)
    t0 = time.perf_counter()
    counts = {"high": 0, "medium": 0, "low": 0}
    scored_total = 0

    try:
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
    except Exception:
        db.rollback()
        _record_upload_audit(
            db,
            ctx=ctx,
            filename=filename,
            content_type=content_type,
            file_size_bytes=len(contents),
            status_value="failed",
            rows_uploaded=len(transactions),
            rows_scored=scored_total,
            high_count=counts["high"],
            medium_count=counts["medium"],
            low_count=counts["low"],
            error_message="Scoring failed before the batch could be saved",
        )
        db.commit()
        raise

    _record_upload_audit(
        db,
        ctx=ctx,
        filename=filename,
        content_type=content_type,
        file_size_bytes=len(contents),
        status_value="success",
        rows_uploaded=len(transactions),
        rows_scored=scored_total,
        high_count=counts["high"],
        medium_count=counts["medium"],
        low_count=counts["low"],
    )
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


@router.get("/audits")
async def list_upload_audits(
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(get_current_user),
) -> dict[str, list[dict[str, Any]]]:
    rows = (
        db.query(UploadAudit)
        .filter(UploadAudit.tenant_id == ctx.tenant_id)
        .order_by(UploadAudit.created_at.desc())
        .limit(10)
        .all()
    )
    return {
        "items": [
            {
                "id": str(row.id),
                "filename": row.filename,
                "status": row.status,
                "rows_uploaded": row.rows_uploaded,
                "rows_scored": row.rows_scored,
                "high": row.high_count,
                "medium": row.medium_count,
                "low": row.low_count,
                "file_size_bytes": row.file_size_bytes,
                "error_message": row.error_message,
                "created_at": row.created_at,
            }
            for row in rows
        ],
    }
