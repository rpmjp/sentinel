"""Auth endpoints: /auth/login, /auth/me."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from api.config import get_settings
from api.db.database import get_db
from api.db.models import Tenant, User
from api.schemas.auth import CurrentUserResponse, LoginRequest, TokenResponse
from api.services.auth import AuthContext, get_current_user
from api.services.security import create_access_token, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = db.query(User).filter(User.email == payload.email, User.deleted_at.is_(None)).one_or_none()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    token = create_access_token(
        sub=str(user.id),
        tenant_id=str(user.tenant_id),
        role=user.role,
    )
    return TokenResponse(
        access_token=token,
        expires_in_minutes=settings.jwt_expire_minutes,
    )


@router.get("/me", response_model=CurrentUserResponse)
async def me(
    ctx: AuthContext = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CurrentUserResponse:
    user = db.get(User, ctx.user_id)
    tenant = db.get(Tenant, ctx.tenant_id)
    if user is None or tenant is None:
        raise HTTPException(status_code=404, detail="User or tenant not found")
    return CurrentUserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        tenant_id=tenant.id,
        tenant_slug=tenant.slug,
    )