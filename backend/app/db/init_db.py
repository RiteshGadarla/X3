"""
Database initialisation — creates tables and seeds default data.
Called on app startup.
"""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text

from app.db.base import Base
from app.db.session import engine
from app.models import Role, User, Project, KBArticle, Notification  # registers all tables
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

# Columns to add if missing (table, column, sql_type_default)
_MIGRATIONS = [
    ("users",   "is_vip",              "BOOLEAN NOT NULL DEFAULT 0"),
    ("tickets", "project_id",          "INTEGER REFERENCES projects(id)"),
    ("tickets", "is_vip_customer",     "BOOLEAN NOT NULL DEFAULT 0"),
    ("tickets", "recurring_issue",     "BOOLEAN NOT NULL DEFAULT 0"),
    ("tickets", "dedup_conflict_flag", "BOOLEAN NOT NULL DEFAULT 0"),
]


async def _run_column_migrations(conn) -> None:
    """Add any missing columns to existing tables (SQLite ALTER TABLE)."""
    for table, column, col_def in _MIGRATIONS:
        try:
            # PRAGMA table_info returns one row per column
            rows = await conn.execute(text(f"PRAGMA table_info({table})"))
            existing = {row[1] for row in rows}  # index 1 = column name
            if column not in existing:
                await conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {col_def}"))
                logger.info(f"Migration: added column {table}.{column}")
        except Exception as e:
            logger.warning(f"Migration skipped for {table}.{column}: {e}")


async def init_db() -> None:
    """Create all tables, run column migrations, and seed mandatory data."""
    async with engine.begin() as conn:
        # 1. Create brand-new tables (projects, kb_articles, notifications)
        await conn.run_sync(Base.metadata.create_all)
        # 2. Add missing columns to existing tables
        await _run_column_migrations(conn)
    logger.info("Database tables created / verified.")

    from app.db.session import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        await _seed_roles(db)
        await _seed_admin_user(db)
        await _seed_default_project(db)
        await db.commit()


async def _seed_roles(db: AsyncSession) -> None:
    for role_data in DEFAULT_ROLES:
        result = await db.execute(select(Role).where(Role.name == role_data["name"]))
        if not result.scalar_one_or_none():
            db.add(Role(**role_data))
            logger.info(f"Seeded role: {role_data['name']}")


async def _seed_default_project(db: AsyncSession) -> None:
    result = await db.execute(select(Project).where(Project.slug == "default"))
    if not result.scalar_one_or_none():
        db.add(Project(name="Default Project", slug="default", description="Auto-created default workspace"))
        logger.info("Seeded default project")


async def _seed_admin_user(db: AsyncSession) -> None:
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
