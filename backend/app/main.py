"""
CSAgent — FastAPI Application Entry Point
Phase 2: Foundation + Agentic Automation + Qdrant Vector DB
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.logging import configure_logging, get_logger, clear_log_file
from app.core.qdrant import get_qdrant, close_qdrant
from app.db.init_db import init_db
from app.api.v1.router import api_router

settings = get_settings()
configure_logging()
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"🚀 Starting {settings.app_name} [{settings.app_env}]")
    await init_db()
    logger.info("✅ Database initialised")

    # Connect Qdrant
    try:
        await get_qdrant()
        logger.info("⚡ Qdrant connected (Vector DB enabled)")
    except Exception as e:
        logger.warning(f"⚠️ Qdrant unavailable: {e}. Running without cache.")

    # Connect Redis
    from app.core.redis import init_redis, close_redis
    await init_redis()

    clear_log_file()
    yield

    # Shutdown
    await close_redis()
    await close_qdrant()
    logger.info("🛑 Shutting down CSAgent backend")


app = FastAPI(
    title="CSAgent API",
    description="AI-Infused SDLC Customer Support Agent — Phase 2",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routes ───────────────────────────────────────────────────────────────────
app.include_router(api_router, prefix=settings.api_v1_prefix)


@app.get("/health", tags=["Health"])
async def health_check():
    from app.core.qdrant import get_qdrant_stats
    qdrant_stats = await get_qdrant_stats()
    return {
        "status": "ok",
        "app": settings.app_name,
        "env": settings.app_env,
        "phase": 2,
        "qdrant": qdrant_stats,
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.app_env == "development",
    )
