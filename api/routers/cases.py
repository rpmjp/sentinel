"""Case management endpoints."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import and_, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, aliased

from api.db.database import get_db
from api.db.models import (
    AnalystDecision,
    Case,
    CaseEntity,
    CaseNote,
    CaseTransaction,
    Prediction,
    Transaction,
)
from api.routers.investigate import InvestigateItem
from api.services.auth import AuthContext, get_current_user

router = APIRouter(prefix="/cases", tags=["cases"])

VALID_STATUSES = {"open", "investigating", "waiting", "escalated", "closed"}
VALID_PRIORITIES = {"low", "medium", "high", "critical"}


class CaseCreate(BaseModel):
    title: str = Field(min_length=1, max_length=256)
    description: str | None = None
    priority: str = "medium"
    status: str = "open"
    assigned_to: uuid.UUID | None = None
    sla_due_at: datetime | None = None
    transaction_ids: list[uuid.UUID] = Field(default_factory=list)
    entity_ids: list[str] = Field(default_factory=list)


class CaseUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=256)
    description: str | None = None
    status: str | None = None
    priority: str | None = None
    assigned_to: uuid.UUID | None = None
    sla_due_at: datetime | None = None
    outcome: str | None = None


class LinkTransactionsPayload(BaseModel):
    transaction_ids: list[uuid.UUID] = Field(min_length=1)


class LinkEntitiesPayload(BaseModel):
    entity_ids: list[str] = Field(min_length=1)
    role: str = Field(default="related", max_length=32)


class CaseNoteCreate(BaseModel):
    content: str = Field(min_length=1)


class CaseStats(BaseModel):
    open: int
    overdue: int
    critical: int
    unassigned: int


class CaseSummary(BaseModel):
    id: uuid.UUID
    title: str
    description: str | None
    status: str
    priority: str
    assigned_to: uuid.UUID | None
    sla_due_at: datetime | None
    created_at: datetime
    updated_at: datetime
    closed_at: datetime | None
    outcome: str | None
    transaction_count: int
    entity_count: int
    note_count: int


class CaseListResponse(BaseModel):
    items: list[CaseSummary]
    stats: CaseStats


class CaseEntityOut(BaseModel):
    account_id: str
    role: str
    added_at: datetime


class CaseNoteOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    content: str
    created_at: datetime


class CaseDetail(CaseSummary):
    transactions: list[InvestigateItem]
    entities: list[CaseEntityOut]
    notes: list[CaseNoteOut]


class CaseNoteResponse(BaseModel):
    id: uuid.UUID
    content: str
    created_at: datetime


def _validate_case_values(priority: str | None = None, case_status: str | None = None) -> None:
    if priority is not None and priority not in VALID_PRIORITIES:
        raise HTTPException(status_code=400, detail="priority must be low, medium, high, or critical")
    if case_status is not None and case_status not in VALID_STATUSES:
        raise HTTPException(
            status_code=400,
            detail="status must be open, investigating, waiting, escalated, or closed",
        )


def _case_or_404(case_id: uuid.UUID, db: Session, ctx: AuthContext) -> Case:
    case = db.query(Case).filter(Case.id == case_id, Case.tenant_id == ctx.tenant_id).one_or_none()
    if case is None:
        raise HTTPException(status_code=404, detail="case not found")
    return case


def _touch_case(case: Case) -> None:
    case.updated_at = datetime.now(timezone.utc)


def _is_overdue(case: Case, now: datetime) -> bool:
    if case.sla_due_at is None or case.status == "closed":
        return False
    due_at = case.sla_due_at
    if due_at.tzinfo is None:
        due_at = due_at.replace(tzinfo=timezone.utc)
    return due_at < now


def _summarize_case(case: Case, db: Session) -> CaseSummary:
    transaction_count = (
        db.query(func.count(CaseTransaction.transaction_id))
        .filter(CaseTransaction.case_id == case.id)
        .scalar()
        or 0
    )
    entity_count = (
        db.query(func.count(CaseEntity.account_id))
        .filter(CaseEntity.case_id == case.id)
        .scalar()
        or 0
    )
    note_count = db.query(func.count(CaseNote.id)).filter(CaseNote.case_id == case.id).scalar() or 0

    return CaseSummary(
        id=case.id,
        title=case.title,
        description=case.description,
        status=case.status,
        priority=case.priority,
        assigned_to=case.assigned_to,
        sla_due_at=case.sla_due_at,
        created_at=case.created_at,
        updated_at=case.updated_at,
        closed_at=case.closed_at,
        outcome=case.outcome,
        transaction_count=int(transaction_count),
        entity_count=int(entity_count),
        note_count=int(note_count),
    )


def _link_transactions(
    case: Case,
    transaction_ids: list[uuid.UUID],
    db: Session,
    ctx: AuthContext,
) -> int:
    if not transaction_ids:
        return 0

    valid_ids = set(
        db.execute(
            select(Transaction.id).where(
                Transaction.tenant_id == ctx.tenant_id,
                Transaction.id.in_(transaction_ids),
            )
        ).scalars()
    )
    missing = [str(txn_id) for txn_id in transaction_ids if txn_id not in valid_ids]
    if missing:
        raise HTTPException(status_code=404, detail=f"transaction not found: {missing[0]}")

    existing = set(
        db.execute(
            select(CaseTransaction.transaction_id).where(
                CaseTransaction.case_id == case.id,
                CaseTransaction.transaction_id.in_(transaction_ids),
            )
        ).scalars()
    )
    added = 0
    seen = set(existing)
    for txn_id in transaction_ids:
        if txn_id in seen:
            continue
        db.add(CaseTransaction(case_id=case.id, transaction_id=txn_id))
        seen.add(txn_id)
        added += 1
    return added


def _link_entities(case: Case, entity_ids: list[str], role: str, db: Session) -> int:
    clean_ids = [entity.strip() for entity in entity_ids if entity.strip()]
    if not clean_ids:
        return 0
    existing = set(
        db.execute(
            select(CaseEntity.account_id).where(
                CaseEntity.case_id == case.id,
                CaseEntity.account_id.in_(clean_ids),
            )
        ).scalars()
    )
    added = 0
    seen = set(existing)
    for account_id in clean_ids:
        if account_id in seen:
            continue
        db.add(CaseEntity(case_id=case.id, account_id=account_id, role=role or "related"))
        seen.add(account_id)
        added += 1
    return added


@router.get("", response_model=CaseListResponse)
async def list_cases(
    case_status: str | None = Query(default=None, alias="status"),
    priority: str | None = Query(default=None),
    assigned_to: str | None = Query(default=None),
    overdue: bool | None = Query(default=None),
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(get_current_user),
) -> CaseListResponse:
    _validate_case_values(priority=priority, case_status=case_status)
    now = datetime.now(timezone.utc)
    filters = [Case.tenant_id == ctx.tenant_id]
    if case_status:
        filters.append(Case.status == case_status)
    if priority:
        filters.append(Case.priority == priority)
    if assigned_to == "unassigned":
        filters.append(Case.assigned_to.is_(None))
    elif assigned_to:
        try:
            filters.append(Case.assigned_to == uuid.UUID(assigned_to))
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="assigned_to must be a user id or unassigned") from exc
    if overdue is True:
        filters.extend([Case.sla_due_at.is_not(None), Case.sla_due_at < now, Case.status != "closed"])
    elif overdue is False:
        filters.append(or_(Case.sla_due_at.is_(None), Case.sla_due_at >= now, Case.status == "closed"))

    rows = (
        db.query(Case)
        .filter(and_(*filters))
        .order_by(Case.sla_due_at.is_(None), Case.sla_due_at.asc(), Case.updated_at.desc())
        .all()
    )

    stats_rows = db.query(Case).filter(Case.tenant_id == ctx.tenant_id).all()
    stats = CaseStats(
        open=sum(1 for case in stats_rows if case.status != "closed"),
        overdue=sum(
            1
            for case in stats_rows
            if _is_overdue(case, now)
        ),
        critical=sum(1 for case in stats_rows if case.priority == "critical" and case.status != "closed"),
        unassigned=sum(1 for case in stats_rows if case.assigned_to is None and case.status != "closed"),
    )
    return CaseListResponse(items=[_summarize_case(case, db) for case in rows], stats=stats)


@router.post("", response_model=CaseDetail, status_code=status.HTTP_201_CREATED)
async def create_case(
    payload: CaseCreate,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(get_current_user),
) -> CaseDetail:
    _validate_case_values(priority=payload.priority, case_status=payload.status)
    case = Case(
        tenant_id=ctx.tenant_id,
        title=payload.title.strip(),
        description=payload.description,
        status=payload.status,
        priority=payload.priority,
        assigned_to=payload.assigned_to,
        sla_due_at=payload.sla_due_at,
        created_by=ctx.user_id,
    )
    if case.status == "closed":
        case.closed_at = datetime.now(timezone.utc)

    db.add(case)
    db.flush()
    _link_transactions(case, payload.transaction_ids, db, ctx)
    _link_entities(case, payload.entity_ids, "related", db)
    db.commit()
    db.refresh(case)
    return _case_detail(case, db)


@router.get("/{case_id}", response_model=CaseDetail)
async def get_case(
    case_id: uuid.UUID,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(get_current_user),
) -> CaseDetail:
    case = _case_or_404(case_id, db, ctx)
    return _case_detail(case, db)


@router.patch("/{case_id}", response_model=CaseDetail)
async def update_case(
    case_id: uuid.UUID,
    payload: CaseUpdate,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(get_current_user),
) -> CaseDetail:
    _validate_case_values(priority=payload.priority, case_status=payload.status)
    case = _case_or_404(case_id, db, ctx)

    if payload.title is not None:
        case.title = payload.title.strip()
    if payload.description is not None:
        case.description = payload.description
    if payload.priority is not None:
        case.priority = payload.priority
    if payload.status is not None:
        case.status = payload.status
        case.closed_at = datetime.now(timezone.utc) if payload.status == "closed" else None
    if "assigned_to" in payload.model_fields_set:
        case.assigned_to = payload.assigned_to
    if "sla_due_at" in payload.model_fields_set:
        case.sla_due_at = payload.sla_due_at
    if "outcome" in payload.model_fields_set:
        case.outcome = payload.outcome
    _touch_case(case)
    db.commit()
    db.refresh(case)
    return _case_detail(case, db)


@router.post("/{case_id}/transactions", response_model=CaseDetail)
async def link_transactions(
    case_id: uuid.UUID,
    payload: LinkTransactionsPayload,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(get_current_user),
) -> CaseDetail:
    case = _case_or_404(case_id, db, ctx)
    _link_transactions(case, payload.transaction_ids, db, ctx)
    _touch_case(case)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
    db.refresh(case)
    return _case_detail(case, db)


@router.delete("/{case_id}/transactions/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
async def unlink_transaction(
    case_id: uuid.UUID,
    transaction_id: uuid.UUID,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(get_current_user),
) -> None:
    case = _case_or_404(case_id, db, ctx)
    link = (
        db.query(CaseTransaction)
        .filter(CaseTransaction.case_id == case.id, CaseTransaction.transaction_id == transaction_id)
        .one_or_none()
    )
    if link is None:
        raise HTTPException(status_code=404, detail="case transaction not found")
    db.delete(link)
    _touch_case(case)
    db.commit()


@router.post("/{case_id}/entities", response_model=CaseDetail)
async def link_entities(
    case_id: uuid.UUID,
    payload: LinkEntitiesPayload,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(get_current_user),
) -> CaseDetail:
    case = _case_or_404(case_id, db, ctx)
    _link_entities(case, payload.entity_ids, payload.role, db)
    _touch_case(case)
    db.commit()
    db.refresh(case)
    return _case_detail(case, db)


@router.delete("/{case_id}/entities/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def unlink_entity(
    case_id: uuid.UUID,
    account_id: str,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(get_current_user),
) -> None:
    case = _case_or_404(case_id, db, ctx)
    link = (
        db.query(CaseEntity)
        .filter(CaseEntity.case_id == case.id, CaseEntity.account_id == account_id)
        .one_or_none()
    )
    if link is None:
        raise HTTPException(status_code=404, detail="case entity not found")
    db.delete(link)
    _touch_case(case)
    db.commit()


@router.post("/{case_id}/notes", response_model=CaseNoteResponse, status_code=status.HTTP_201_CREATED)
async def add_note(
    case_id: uuid.UUID,
    payload: CaseNoteCreate,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(get_current_user),
) -> CaseNoteResponse:
    case = _case_or_404(case_id, db, ctx)
    note = CaseNote(case_id=case.id, user_id=ctx.user_id, content=payload.content.strip())
    db.add(note)
    _touch_case(case)
    db.commit()
    db.refresh(note)
    return CaseNoteResponse(id=note.id, content=note.content, created_at=note.created_at)


def _case_detail(case: Case, db: Session) -> CaseDetail:
    summary = _summarize_case(case, db)
    decision_alias = aliased(AnalystDecision)
    txn_rows = db.execute(
        select(Transaction, Prediction, decision_alias.decision)
        .join(CaseTransaction, CaseTransaction.transaction_id == Transaction.id)
        .join(Prediction, Prediction.transaction_id == Transaction.id)
        .outerjoin(decision_alias, decision_alias.transaction_id == Transaction.id)
        .where(CaseTransaction.case_id == case.id)
        .order_by(Prediction.scored_at.desc())
    ).all()
    entities = (
        db.query(CaseEntity)
        .filter(CaseEntity.case_id == case.id)
        .order_by(CaseEntity.added_at.desc())
        .all()
    )
    notes = (
        db.query(CaseNote)
        .filter(CaseNote.case_id == case.id)
        .order_by(CaseNote.created_at.desc())
        .all()
    )

    return CaseDetail(
        **summary.model_dump(),
        transactions=[
            InvestigateItem(
                transaction_id=t.id,
                score=p.score,
                risk_band=p.risk_band,
                amount=t.amount,
                type=t.type,
                name_orig=t.name_orig,
                name_dest=t.name_dest,
                scored_at=p.scored_at,
                decision=d,
            )
            for t, p, d in txn_rows
        ],
        entities=[
            CaseEntityOut(account_id=item.account_id, role=item.role, added_at=item.added_at)
            for item in entities
        ],
        notes=[
            CaseNoteOut(
                id=note.id,
                user_id=note.user_id,
                content=note.content,
                created_at=note.created_at,
            )
            for note in notes
        ],
    )
