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
from app.core.logging import get_logger
from app.core.redis import cache_response

logger = get_logger(__name__)

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
    logger.info(f"Received ticket submission from {payload.customer_email}")
    if not payload.ai_disclosure_accepted:
        raise HTTPException(
            status_code=400,
            detail="You must accept the AI assistance disclosure to submit a ticket.",
        )

    # ── Qdrant Spam Prevention (hash dedup) ──
    try:
        from app.core.qdrant import check_spam_duplicate
        is_spam = await check_spam_duplicate(payload.customer_email, payload.subject, payload.description)
        if is_spam:
            raise HTTPException(
                status_code=429,
                detail="Duplicate submission detected. Please wait 60 seconds before resubmitting.",
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"Qdrant spam check skipped: {e}")

    ticket = Ticket(
        ticket_ref=_generate_ref(),
        customer_name=payload.customer_name,
        customer_email=payload.customer_email,
        subject=payload.subject,
        description=payload.description,
        category=payload.category,
        ai_disclosure_accepted=True,
        priority=Priority.UNASSIGNED,  # Default; AG-02 will re-triage
        status=TicketStatus.NEW,
    )
    ticket.sla_deadline = await _get_sla_deadline(db, ticket.priority)
    db.add(ticket)
    await db.flush()
    await db.refresh(ticket)

    # ── Store ticket fingerprint in Qdrant for AG-03 dedup ──
    try:
        from app.core.qdrant import store_ticket_fingerprint
        await store_ticket_fingerprint(ticket.ticket_ref, payload.subject, payload.description, payload.category)
    except Exception as e:
        logger.warning(f"Qdrant fingerprint store skipped: {e}")
    
    # Run LangGraph pipeline in the background
    logger.info(f"Scheduling background pipeline for ticket {ticket.ticket_ref}")
    background_tasks.add_task(run_pipeline, ticket.id)
    
    return ticket


# ─── AUTHENTICATED: Ticket Queue (UI-01) ─────────────────────────────────────
@router.get("/", response_model=TicketListResponse)
@cache_response(expire=15)
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

    logger.info(f"Updating ticket {ticket.ticket_ref} by user")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(ticket, field, value)

    if payload.status == TicketStatus.RESOLVED and not ticket.resolved_at:
        ticket.resolved_at = datetime.now(timezone.utc)

    await db.flush()
    await db.refresh(ticket)
    return ticket


# ─── PHASE 2: Child Tickets (AG-11 Splitting) ────────────────────────────────
@router.get("/{ticket_id}/children", response_model=list[TicketOut])
async def get_child_tickets(
    ticket_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Get all child tickets created by AG-11 ticket splitting."""
    result = await db.execute(
        select(Ticket).where(Ticket.parent_id == ticket_id).order_by(Ticket.created_at.asc())
    )
    children = result.scalars().all()
    return children


# ─── PHASE 2: Linked Tickets (AG-03 Dedup) ───────────────────────────────────
@router.get("/{ticket_id}/linked", response_model=list[TicketOut])
async def get_linked_tickets(
    ticket_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Get all tickets linked to the same master ticket (dedup group)."""
    # First get the ticket to find its master_ticket_id
    result = await db.execute(select(Ticket).where(Ticket.id == ticket_id))
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    master_id = ticket.master_ticket_id or ticket.id
    result = await db.execute(
        select(Ticket)
        .where(Ticket.master_ticket_id == master_id)
        .where(Ticket.id != ticket_id)
        .order_by(Ticket.created_at.asc())
    )
    linked = result.scalars().all()
    return linked


# ─── PUBLIC: Customer Portal Status Check ───────────────────────────────────────
@router.get("/status/check", response_model=TicketOut)
async def get_ticket_status(
    ticket_ref: str = Query(..., description="The unique ticket reference ID"),
    customer_email: str = Query(..., description="The email used to submit the ticket"),
    db: AsyncSession = Depends(get_db),
):
    """Allow customers to check their ticket status without logging in."""
    result = await db.execute(
        select(Ticket)
        .where(Ticket.ticket_ref == ticket_ref)
        .where(Ticket.customer_email == customer_email)
    )
    ticket = result.scalar_one_or_none()
    
    if not ticket:
        raise HTTPException(
            status_code=404,
            detail="Ticket not found with the provided reference and email combination."
        )
    return ticket
