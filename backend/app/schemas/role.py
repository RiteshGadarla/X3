"""Role schemas."""
from datetime import datetime
from pydantic import BaseModel


class RoleCreate(BaseModel):
    name: str
    description: str = ""


class RoleUpdate(BaseModel):
    name: str | None = None
    description: str | None = None


class RoleOut(BaseModel):
    id: int
    name: str
    description: str
    created_at: datetime

    model_config = {"from_attributes": True}
