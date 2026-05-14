"""Tenant watchlist endpoints."""

from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from api.db.database import get_db
from api.db.models import WatchlistEntry
from api.services.auth import AuthContext, get_current_user

router = APIRouter(prefix="/watchlists", tags=["watchlists"])

VALID_LIST_TYPES = {"blocked", "trusted"}


class WatchlistIn(BaseModel):
    account_id: str = Field(min_length=1, max_length=64)
    list_type: str = Field(description="blocked | trusted")
    reason: str | None = Field(default=None, max_length=512)


class WatchlistItem(BaseModel):
    id: uuid.UUID
    account_id: str
    list_type: str
    reason: str | None
    created_at: datetime


class WatchlistResponse(BaseModel):
    items: list[WatchlistItem]


@router.get("", response_model=WatchlistResponse)
async def list_watchlist(
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(get_current_user),
) -> WatchlistResponse:
    items = (
        db.query(WatchlistEntry)
        .filter(WatchlistEntry.tenant_id == ctx.tenant_id)
        .order_by(WatchlistEntry.created_at.desc())
        .all()
    )
    return WatchlistResponse(
        items=[
            WatchlistItem(
                id=item.id,
                account_id=item.account_id,
                list_type=item.list_type,
                reason=item.reason,
                created_at=item.created_at,
            )
            for item in items
        ]
    )


@router.post("", response_model=WatchlistItem, status_code=status.HTTP_201_CREATED)
async def add_watchlist_entry(
    payload: WatchlistIn,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(get_current_user),
) -> WatchlistItem:
    if payload.list_type not in VALID_LIST_TYPES:
        raise HTTPException(status_code=400, detail="list_type must be blocked or trusted")

    item = WatchlistEntry(
        tenant_id=ctx.tenant_id,
        account_id=payload.account_id,
        list_type=payload.list_type,
        reason=payload.reason,
        created_by=ctx.user_id,
    )
    db.add(item)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="account already exists on that list") from exc
    db.refresh(item)
    return WatchlistItem(
        id=item.id,
        account_id=item.account_id,
        list_type=item.list_type,
        reason=item.reason,
        created_at=item.created_at,
    )


@router.delete("/account/{account_id}/{list_type}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_watchlist_account(
    account_id: str,
    list_type: str,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(get_current_user),
) -> None:
    if list_type not in VALID_LIST_TYPES:
        raise HTTPException(status_code=400, detail="list_type must be blocked or trusted")

    item = (
        db.query(WatchlistEntry)
        .filter(
            WatchlistEntry.account_id == account_id,
            WatchlistEntry.list_type == list_type,
            WatchlistEntry.tenant_id == ctx.tenant_id,
        )
        .one_or_none()
    )
    if item is None:
        raise HTTPException(status_code=404, detail="watchlist entry not found")
    db.delete(item)
    db.commit()


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_watchlist_entry(
    entry_id: uuid.UUID,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(get_current_user),
) -> None:
    item = (
        db.query(WatchlistEntry)
        .filter(WatchlistEntry.id == entry_id, WatchlistEntry.tenant_id == ctx.tenant_id)
        .one_or_none()
    )
    if item is None:
        raise HTTPException(status_code=404, detail="watchlist entry not found")
    db.delete(item)
    db.commit()
