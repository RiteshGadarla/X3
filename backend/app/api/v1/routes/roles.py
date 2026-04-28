"""Role management routes (Admin only)."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_db
from app.models.role import Role
from app.schemas.role import RoleCreate, RoleUpdate, RoleOut
from app.api.deps import require_admin

router = APIRouter(prefix="/roles", tags=["Roles"])


@router.get("/", response_model=list[RoleOut])
async def list_roles(db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    result = await db.execute(select(Role).order_by(Role.name))
    return result.scalars().all()


@router.post("/", response_model=RoleOut, status_code=status.HTTP_201_CREATED)
async def create_role(
    payload: RoleCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin),
):
    existing = await db.execute(select(Role).where(Role.name == payload.name))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Role with this name already exists")
    role = Role(**payload.model_dump())
    db.add(role)
    await db.flush()
    await db.refresh(role)
    return role


@router.patch("/{role_id}", response_model=RoleOut)
async def update_role(
    role_id: int,
    payload: RoleUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin),
):
    result = await db.execute(select(Role).where(Role.id == role_id))
    role = result.scalar_one_or_none()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(role, field, value)
    await db.flush()
    await db.refresh(role)
    return role


@router.delete("/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_role(role_id: int, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    result = await db.execute(select(Role).where(Role.id == role_id))
    role = result.scalar_one_or_none()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    await db.delete(role)
