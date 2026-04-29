"""Ticket schemas — Phase 1 + Phase 2."""
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
    routing_target: str | None = None


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
    # Phase 2 fields
    parent_id: int | None = None
    master_ticket_id: int | None = None
    routing_target: str | None = None
    sdlc_devops_ok: bool = False
    sdlc_qa_ok: bool = False
    loop_count: int = 0

    model_config = {"from_attributes": True}


class TicketListResponse(BaseModel):
    items: list[TicketOut]
    total: int
    page: int
    page_size: int


# ── Phase 2: SDLC Gate Schemas ──

class SDLCWebhookPayload(BaseModel):
    """Webhook payload from DevOps or QA systems."""
    ticket_ref: str
    source: str  # "devops" or "qa"
    status: str  # "passed" or "failed"
    details: str = ""


class SDLCStatusOut(BaseModel):
    ticket_ref: str
    routing_target: str | None
    devops_confirmed: bool
    qa_confirmed: bool
    gate_passed: bool
    status: TicketStatus

    model_config = {"from_attributes": True}


# ── Phase 2: Action/Command System ──

class ActionCommand(BaseModel):
    """Extensible JSON-based command for future avatar/button API integration."""
    action: str  # e.g., "filter_tickets", "get_ticket_detail", "approve_sdlc"
    params: dict = {}


class ActionResult(BaseModel):
    success: bool
    action: str
    result: dict = {}
    error: str | None = None
