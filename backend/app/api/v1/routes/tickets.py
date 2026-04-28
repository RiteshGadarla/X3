"""
Ticket routes — public portal submission + authenticated queue management.
"""

import uuid
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.db.session import get_db, AsyncSessionLocal
from app.models.ticket import Ticket, Priority, TicketStatus
from app.models.sla_config import SLAConfig
from app.schemas.ticket import TicketSubmit, TicketUpdate, TicketOut, TicketListResponse
from app.api.deps import get_current_user, require_manager_or_admin
from app.models.user import User
from app.services.langgraph.graph import process_ticket

router = APIRouter(prefix="/tickets", tags=["Tickets"])


def _generate_ref() -> str:
    return f"TKT-{uuid.uuid4().hex[:8].upper()}"


async def _get_sla_deadline(db: AsyncSession, priority: Priority) -> datetime | None:
    result = await db.execute(
        select(SLAConfig).where(SLAConfig.priority == priority.value, SLAConfig.is_active == True)
    )
    config = result.scalar_one_or_none()
    if config:
        return datetime.now(timezone.utc) + timedelta(minutes=config.resolution_time_minutes)
    # Fallback defaults
    defaults = {Priority.P1: 15, Priority.P2: 60, Priority.P3: 240, Priority.P4: 480}
    return datetime.now(timezone.utc) + timedelta(minutes=defaults.get(priority, 480))


async def run_pipeline(ticket_id: int):
    async with AsyncSessionLocal() as bg_db:
        await process_ticket(ticket_id, bg_db)


# ─── PUBLIC: Customer Portal Submission (UI-09) ───────────────────────────────
@router.post("/submit", response_model=TicketOut, status_code=status.HTTP_201_CREATED)
async def submit_ticket(payload: TicketSubmit, background_tasks: BackgroundTasks, db: AsyncSession = Depends(get_db)):
    if not payload.ai_disclosure_accepted:
        raise HTTPException(
            status_code=400,
            detail="You must accept the AI assistance disclosure to submit a ticket.",
        )

    ticket = Ticket(
        ticket_ref=_generate_ref(),
        customer_name=payload.customer_name,
        customer_email=payload.customer_email,
        subject=payload.subject,
        description=payload.description,
        category=payload.category,
        ai_disclosure_accepted=True,
        priority=Priority.P4,  # Default; AG-02 will re-triage
        status=TicketStatus.NEW,
    )
    ticket.sla_deadline = await _get_sla_deadline(db, ticket.priority)
    db.add(ticket)
    await db.flush()
    await db.refresh(ticket)
    
    # Run LangGraph pipeline in the background
    background_tasks.add_task(run_pipeline, ticket.id)
    
    return ticket


# ─── AUTHENTICATED: Ticket Queue (UI-01) ─────────────────────────────────────
@router.get("/", response_model=TicketListResponse)
async def list_tickets(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: TicketStatus | None = None,
    priority: Priority | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    query = select(Ticket)
    if status:
        query = query.where(Ticket.status == status)
    if priority:
        query = query.where(Ticket.priority == priority)

    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar_one()

    query = query.order_by(Ticket.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    items = result.scalars().all()

    return TicketListResponse(items=items, total=total, page=page, page_size=page_size)


@router.get("/{ticket_id}", response_model=TicketOut)
async def get_ticket(
    ticket_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(select(Ticket).where(Ticket.id == ticket_id))
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return ticket


@router.patch("/{ticket_id}", response_model=TicketOut)
async def update_ticket(
    ticket_id: int,
    payload: TicketUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(select(Ticket).where(Ticket.id == ticket_id))
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(ticket, field, value)

    if payload.status == TicketStatus.RESOLVED and not ticket.resolved_at:
        ticket.resolved_at = datetime.now(timezone.utc)

    await db.flush()
    await db.refresh(ticket)
    return ticket
