"""
CSAgent — FastAPI Application Entry Point
Phase 1: Foundation, Admin Control & Web-Centric Core
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.logging import configure_logging, get_logger
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
    yield
    logger.info("🛑 Shutting down CSAgent backend")


app = FastAPI(
    title="CSAgent API",
    description="AI-Infused SDLC Customer Support Agent — Phase 1",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routes ───────────────────────────────────────────────────────────────────
app.include_router(api_router, prefix=settings.api_v1_prefix)


@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "ok", "app": settings.app_name, "env": settings.app_env}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.app_env == "development",
    )
