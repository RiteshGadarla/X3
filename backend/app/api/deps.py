"""
FastAPI dependency injection — role resolved from X-Role request header.
No login / JWT required. The frontend sends X-Role based on the URL prefix.
"""

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.models.user import User
from app.models.role import Role

VALID_ROLES = {"Admin", "Manager", "Support Agent", "VP Customer Success", "Legal"}


async def get_current_user(
    x_role: str = Header(default="", alias="X-Role"),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Resolve the acting user from the X-Role header.

    Finds the first active user in the DB that holds the requested role.
    Raises 401 if the header is missing/invalid, 404 if no matching user exists.
    """
    if not x_role or x_role not in VALID_ROLES:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="X-Role header is required and must be a valid role",
        )

    result = await db.execute(
        select(User)
        .join(User.role)
        .where(Role.name == x_role, User.is_active == True)  # noqa: E712
        .options(selectinload(User.role))
        .limit(1)
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No active user found for role '{x_role}'",
        )
    return user


async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.role or current_user.role.name != "Admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user


async def require_manager_or_admin(current_user: User = Depends(get_current_user)) -> User:
    allowed = {"Admin", "Manager"}
    role_name = current_user.role.name if current_user.role else ""
    if role_name not in allowed:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Manager or Admin access required")
    return current_user


async def require_vp_or_admin(current_user: User = Depends(get_current_user)) -> User:
    allowed = {"Admin", "VP Customer Success"}
    role_name = current_user.role.name if current_user.role else ""
    if role_name not in allowed:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="VP or Admin access required")
    return current_user


async def require_elevated_access(current_user: User = Depends(get_current_user)) -> User:
    """Admin, Manager, or VP Customer Success — analytics reports (BRD R-02, R-03, R-04)."""
    allowed = {"Admin", "Manager", "VP Customer Success"}
    role_name = current_user.role.name if current_user.role else ""
    if role_name not in allowed:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Elevated access required")
    return current_user


async def require_kb_reviewer(current_user: User = Depends(get_current_user)) -> User:
    """Admin, Manager, or Legal — can view KB drafts (UI-07). Only Manager/Admin can publish."""
    allowed = {"Admin", "Manager", "Legal"}
    role_name = current_user.role.name if current_user.role else ""
    if role_name not in allowed:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="KB reviewer access required")
    return current_user
