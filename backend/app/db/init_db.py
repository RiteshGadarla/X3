"""
Database initialisation — creates tables and seeds default data.
Called on app startup.
"""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.base import Base
from app.db.session import engine
from app.models.role import Role
from app.models.user import User
from app.core.security import hash_password
from app.core.logging import get_logger

logger = get_logger(__name__)

# Default roles required by Phase 1 RBAC
DEFAULT_ROLES = [
    {"name": "Admin", "description": "Full system access"},
    {"name": "Support Agent", "description": "Handles ticket queue and responses"},
    {"name": "Manager", "description": "Oversees agents, approves escalations"},
    {"name": "VP Customer Success", "description": "Executive view, KPI oversight"},
    {"name": "Legal", "description": "Legal review for compliance escalations"},
]


async def init_db() -> None:
    """Create all tables and seed mandatory data."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables created / verified.")

    from app.db.session import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        await _seed_roles(db)
        await _seed_admin_user(db)
        await db.commit()


async def _seed_roles(db: AsyncSession) -> None:
    for role_data in DEFAULT_ROLES:
        result = await db.execute(select(Role).where(Role.name == role_data["name"]))
        if not result.scalar_one_or_none():
            db.add(Role(**role_data))
            logger.info(f"Seeded role: {role_data['name']}")


async def _seed_admin_user(db: AsyncSession) -> None:
    from app.models.user import User
    from app.core.config import get_settings
    settings = get_settings()
    
    result = await db.execute(select(User).where(User.email == settings.first_superuser))
    if not result.scalar_one_or_none():
        result = await db.execute(select(Role).where(Role.name == "Admin"))
        admin_role = result.scalar_one_or_none()
        user = User(
            email=settings.first_superuser,
            full_name="System Admin",
            hashed_password=hash_password(settings.first_superuser_password),
            role_id=admin_role.id if admin_role else None,
            is_active=True,
        )
        db.add(user)
        logger.info(f"Seeded default admin user: {settings.first_superuser}")
