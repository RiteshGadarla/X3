"""SLA configuration routes (HIL-1)."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_db
from app.models.sla_config import SLAConfig
from app.schemas.sla_config import SLAConfigUpdate, SLAConfigOut, SLAApprove
from app.api.deps import require_admin

router = APIRouter(prefix="/sla", tags=["SLA Config"])

# Default SLA values seeded on first request if none exist
_DEFAULTS = [
    {"priority": "P1", "response_time_minutes": 5,   "resolution_time_minutes": 15},
    {"priority": "P2", "response_time_minutes": 15,  "resolution_time_minutes": 60},
    {"priority": "P3", "response_time_minutes": 30,  "resolution_time_minutes": 240},
    {"priority": "P4", "response_time_minutes": 120, "resolution_time_minutes": 480},
]


async def _ensure_defaults(db: AsyncSession):
    for d in _DEFAULTS:
        result = await db.execute(select(SLAConfig).where(SLAConfig.priority == d["priority"]))
        if not result.scalar_one_or_none():
            db.add(SLAConfig(**d))
    await db.flush()


@router.get("/", response_model=list[SLAConfigOut])
async def list_sla(db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    await _ensure_defaults(db)
    result = await db.execute(select(SLAConfig).order_by(SLAConfig.priority))
    return result.scalars().all()


@router.patch("/{priority}", response_model=SLAConfigOut)
async def update_sla(
    priority: str,
    payload: SLAConfigUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin),
):
    await _ensure_defaults(db)
    result = await db.execute(select(SLAConfig).where(SLAConfig.priority == priority.upper()))
    config = result.scalar_one_or_none()
    if not config:
        raise HTTPException(status_code=404, detail=f"SLA config for {priority} not found")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(config, field, value)

    # Changing config resets approval — HIL-1 must re-approve
    config.approved_by_admin = False
    await db.flush()
    await db.refresh(config)
    return config


@router.post("/{priority}/approve", response_model=SLAConfigOut)
async def approve_sla(
    priority: str,
    payload: SLAApprove,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin),
):
    """HIL-1: Admin must explicitly approve SLA before AI agents use it."""
    result = await db.execute(select(SLAConfig).where(SLAConfig.priority == priority.upper()))
    config = result.scalar_one_or_none()
    if not config:
        raise HTTPException(status_code=404, detail="SLA config not found")
    config.approved_by_admin = payload.approved
    await db.flush()
    await db.refresh(config)
    return config
