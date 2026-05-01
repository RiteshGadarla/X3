"""Auth routes — kept for backward compatibility, not used by the frontend."""

from fastapi import APIRouter

router = APIRouter(prefix="/auth", tags=["Auth"])
