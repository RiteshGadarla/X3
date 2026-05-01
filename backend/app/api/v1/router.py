"""API v1 router — aggregates all route modules."""

from fastapi import APIRouter
from app.api.v1.routes import auth, roles, users, tickets, sla, system, sdlc, actions, documents, analytics, kb

api_router = APIRouter()

api_router.include_router(auth.router)
api_router.include_router(roles.router)
api_router.include_router(users.router)
api_router.include_router(tickets.router)
api_router.include_router(sla.router)
api_router.include_router(system.router)
api_router.include_router(sdlc.router)
api_router.include_router(actions.router)
api_router.include_router(documents.router)
api_router.include_router(analytics.router)
api_router.include_router(kb.router)
