"""SLA Config schemas."""
from datetime import datetime
from pydantic import BaseModel


class SLAConfigUpdate(BaseModel):
    response_time_minutes: int | None = None
    resolution_time_minutes: int | None = None
    is_active: bool | None = None


class SLAConfigOut(BaseModel):
    id: int
    priority: str
    response_time_minutes: int
    resolution_time_minutes: int
    is_active: bool
    approved_by_admin: bool
    updated_at: datetime

    model_config = {"from_attributes": True}


class SLAApprove(BaseModel):
    approved: bool
