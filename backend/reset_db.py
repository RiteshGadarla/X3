"""
Reset script — wipes SQLite, Qdrant, and Redis, then re-initialises fresh
and (by default) seeds a realistic demo dataset so every dashboard has
meaningful values to render.

Usage:
    python reset_db.py             # interactive confirmation, seeds demo data
    python reset_db.py --yes       # skip confirmation
    python reset_db.py --no-fake   # reset + reinit only, no demo data
"""

import asyncio
import os
import sys
from pathlib import Path

# Ensure imports work when running this file directly
sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.core.config import get_settings
from app.core.logging import configure_logging, get_logger

configure_logging()
logger = get_logger(__name__)
settings = get_settings()


# ── 1. SQLite ────────────────────────────────────────────────────────────────
async def reset_sqlite() -> None:
    """Drop all tables and delete the SQLite file, then recreate via init_db."""
    from app.db.session import engine
    from app.db.base import Base
    # ensure all model modules are imported so metadata is complete
    import app.models  # noqa: F401

    logger.info("→ Dropping all SQLAlchemy tables…")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()

    # Also remove the .db file when using local SQLite, for a fully clean slate
    db_url = settings.database_url
    if db_url.startswith("sqlite"):
        # sqlite+aiosqlite:///./csagent.db   →  ./csagent.db
        db_path = db_url.split(":///", 1)[-1]
        abs_path = Path(db_path).resolve()
        if abs_path.exists():
            try:
                abs_path.unlink()
                logger.info(f"→ Removed SQLite file: {abs_path}")
            except Exception as e:
                logger.warning(f"Could not delete SQLite file {abs_path}: {e}")

    logger.info("✓ SQLite reset complete")


# ── 2. Qdrant ────────────────────────────────────────────────────────────────
async def reset_qdrant() -> None:
    """Delete every CSAgent collection so they get recreated on next get_qdrant()."""
    from app.core.qdrant import (
        get_qdrant,
        close_qdrant,
        TICKETS_COLLECTION,
        STATE_COLLECTION,
        SPAM_COLLECTION,
        KB_COLLECTION,
    )

    collections = [
        TICKETS_COLLECTION,
        STATE_COLLECTION,
        SPAM_COLLECTION,
        KB_COLLECTION,
    ]

    try:
        client = await get_qdrant()
    except Exception as e:
        logger.warning(f"Qdrant unreachable, skipping vector reset: {e}")
        return

    for name in collections:
        try:
            await client.delete_collection(collection_name=name)
            logger.info(f"→ Dropped Qdrant collection: {name}")
        except Exception as e:
            logger.warning(f"Could not drop {name} (may not exist): {e}")

    await close_qdrant()
    logger.info("✓ Qdrant reset complete")


# ── 3. Redis ─────────────────────────────────────────────────────────────────
async def reset_redis() -> None:
    """FLUSHDB on the configured Redis database."""
    import redis.asyncio as redis

    try:
        client = redis.from_url(settings.redis_url, decode_responses=True)
        await client.ping()
        await client.flushdb()
        logger.info(f"→ Flushed Redis at {settings.redis_url}")
        await client.close()
    except Exception as e:
        logger.warning(f"Redis unreachable, skipping flush: {e}")
        return

    logger.info("✓ Redis reset complete")


# ── 4. Re-initialise fresh ───────────────────────────────────────────────────
async def reinit_fresh() -> None:
    """Recreate SQLite tables, seed defaults, and recreate Qdrant collections."""
    from app.db.init_db import init_db
    from app.core.qdrant import get_qdrant, close_qdrant
    from app.core.redis import init_redis, close_redis

    logger.info("→ Re-initialising SQLite (tables + seed data)…")
    await init_db()

    logger.info("→ Re-initialising Qdrant collections…")
    try:
        await get_qdrant()  # creates missing collections
        await close_qdrant()
    except Exception as e:
        logger.warning(f"Qdrant re-init skipped: {e}")

    logger.info("→ Verifying Redis connection…")
    await init_redis()
    await close_redis()

    logger.info("✅ Fresh initialisation complete")


# ── 5. Demo data seed ────────────────────────────────────────────────────────
async def seed_fake_data() -> None:
    """Populate the freshly-initialised DB with realistic demo records."""
    from app.db.seed_demo import seed_demo_data, DEFAULT_USER_PASSWORD

    logger.info("→ Seeding demo data (users, projects, tickets, KB, notifications)…")
    await seed_demo_data()
    logger.info(f"✓ Demo data ready (extra user password: {DEFAULT_USER_PASSWORD})")


# ── Driver ───────────────────────────────────────────────────────────────────
async def main(skip_confirm: bool, with_fake: bool) -> None:
    if not skip_confirm:
        print("⚠️  This will DELETE all data in:")
        print(f"     • SQLite       → {settings.database_url}")
        print(f"     • Qdrant       → {settings.qdrant_url or 'localhost:6333'}")
        print(f"     • Redis        → {settings.redis_url}")
        if with_fake:
            print("   …and then SEED a realistic demo dataset.")
        ans = input("Type 'YES' to proceed: ").strip()
        if ans != "YES":
            print("Aborted.")
            return

    await reset_qdrant()
    await reset_redis()
    await reset_sqlite()
    await reinit_fresh()

    if with_fake:
        await seed_fake_data()

    print("\n🎉 All data stores have been reset and re-initialised.")
    print(f"   Default admin: {settings.first_superuser}")
    if with_fake:
        from app.db.seed_demo import DEFAULT_USER_PASSWORD
        print(f"   Demo users password: {DEFAULT_USER_PASSWORD}")
        print("   (manager@csagent.ai, vp@csagent.ai, legal@csagent.ai,")
        print("    agent.alex@csagent.ai, agent.priya@csagent.ai, agent.kenji@csagent.ai)")


if __name__ == "__main__":
    skip      = "--yes" in sys.argv or "-y" in sys.argv
    with_fake = "--no-fake" not in sys.argv
    asyncio.run(main(skip_confirm=skip, with_fake=with_fake))
