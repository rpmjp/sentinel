"""Auth dependencies for FastAPI routes."""

from __future__ import annotations

import uuid
from dataclasses import dataclass

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from api.db.database import get_db
from api.db.models import User
from api.services.security import decode_access_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


@dataclass(frozen=True)
class AuthContext:
    user_id: uuid.UUID
    tenant_id: uuid.UUID
    role: str
    email: str


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> AuthContext:
    """Decode JWT, load user, return auth context. 401 on any failure."""
    cred_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_access_token(token)
    except jwt.PyJWTError as e:
        raise cred_exc from e

    user_id = payload.get("sub")
    if not user_id:
        raise cred_exc

    user = db.get(User, uuid.UUID(user_id))
    if user is None or user.deleted_at is not None:
        raise cred_exc

    return AuthContext(
        user_id=user.id,
        tenant_id=user.tenant_id,
        role=user.role,
        email=user.email,
    )


def require_role(*allowed: str):
    """Dependency factory: ensures the current user has one of the allowed roles."""
    def _checker(ctx: AuthContext = Depends(get_current_user)) -> AuthContext:
        if ctx.role not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires one of: {', '.join(allowed)}",
            )
        return ctx
    return _checker