"""Ticket schemas."""
from datetime import datetime
from pydantic import BaseModel, EmailStr
from app.models.ticket import Priority, TicketStatus, SentimentLabel


class TicketSubmit(BaseModel):
    """Public portal submission (UI-09)."""
    customer_name: str
    customer_email: EmailStr
    subject: str
    description: str
    category: str = "General"
    ai_disclosure_accepted: bool  # Mandatory checkbox


class TicketUpdate(BaseModel):
    status: TicketStatus | None = None
    priority: Priority | None = None
    assigned_to_id: int | None = None


class TicketOut(BaseModel):
    id: int
    ticket_ref: str
    customer_name: str
    customer_email: str
    subject: str
    description: str
    category: str
    priority: Priority
    status: TicketStatus
    sentiment: SentimentLabel
    pii_redacted: bool
    ai_disclosure_accepted: bool
    assigned_to_id: int | None
    sla_deadline: datetime | None
    resolved_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TicketListResponse(BaseModel):
    items: list[TicketOut]
    total: int
    page: int
    page_size: int
