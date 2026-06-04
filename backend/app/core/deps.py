from enum import Enum

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import decode_token
from app.models.user import User, UserRole

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)


class TokenError(str, Enum):
    MISSING = "missing token"
    INVALID = "invalid token"
    USER_NOT_FOUND = "user not found"


async def get_current_user(
    token: str | None = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=TokenError.MISSING.value,
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        payload = decode_token(token)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=TokenError.INVALID.value,
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    user_id = int(payload.get("sub", 0))
    res = await db.execute(select(User).where(User.id == user_id))
    user = res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=TokenError.USER_NOT_FOUND.value)
    return user


def require_role(*roles: UserRole):
    async def _check(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="forbidden")
        return user

    return _check


require_organizer = require_role(UserRole.ORGANIZER)
require_jury = require_role(UserRole.JURY, UserRole.ORGANIZER)
require_participant = require_role(UserRole.PARTICIPANT)
