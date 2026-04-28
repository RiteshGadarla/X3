"""User schemas."""
from datetime import datetime
from pydantic import BaseModel, EmailStr
from app.schemas.role import RoleOut


class UserCreate(BaseModel):
    email: EmailStr
    full_name: str
    password: str
    role_id: int | None = None


class UserUpdate(BaseModel):
    full_name: str | None = None
    role_id: int | None = None
    is_active: bool | None = None


class UserOut(BaseModel):
    id: int
    email: str
    full_name: str
    is_active: bool
    role: RoleOut | None
    created_at: datetime

    model_config = {"from_attributes": True}
