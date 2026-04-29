"""
SDLC Gate routes — Phase 2
Handles DevOps/QA webhook confirmations and gate status checks.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_db
from app.models.ticket import Ticket, TicketStatus
from app.models.user import User
from app.schemas.ticket import SDLCWebhookPayload, SDLCStatusOut
from app.api.deps import get_current_user
from app.core.logging import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/sdlc", tags=["SDLC Gate"])


@router.post("/webhook")
async def receive_sdlc_webhook(
    payload: SDLCWebhookPayload,
    db: AsyncSession = Depends(get_db),
):
    """Receive confirmation webhooks from DevOps or QA systems.
    When both are confirmed, the ticket's SDLC gate passes automatically.
    """
    logger.info(f"SDLC Webhook received: {payload.source} → {payload.ticket_ref} ({payload.status})")
    
    result = await db.execute(select(Ticket).where(Ticket.ticket_ref == payload.ticket_ref))
    ticket = result.scalar_one_or_none()
    
    if not ticket:
        raise HTTPException(status_code=404, detail=f"Ticket {payload.ticket_ref} not found")
    
    if payload.source.lower() == "devops":
        ticket.sdlc_devops_ok = payload.status.lower() == "passed"
        logger.info(f"SDLC: DevOps confirmation for {payload.ticket_ref}: {ticket.sdlc_devops_ok}")
    elif payload.source.lower() == "qa":
        ticket.sdlc_qa_ok = payload.status.lower() == "passed"
        logger.info(f"SDLC: QA confirmation for {payload.ticket_ref}: {ticket.sdlc_qa_ok}")
    else:
        raise HTTPException(status_code=400, detail="Source must be 'devops' or 'qa'")
    
    # Check if gate is now passed
    gate_passed = ticket.sdlc_devops_ok and ticket.sdlc_qa_ok
    if gate_passed:
        logger.info(f"SDLC: ✅ DUAL CONFIRMATION COMPLETE for {payload.ticket_ref}. Gate passed!")
        # Only auto-resolve if it's currently in_progress
        if ticket.status == TicketStatus.IN_PROGRESS:
            ticket.status = TicketStatus.RESOLVED
    
    await db.flush()
    await db.refresh(ticket)
    
    return {
        "ticket_ref": payload.ticket_ref,
        "devops_ok": ticket.sdlc_devops_ok,
        "qa_ok": ticket.sdlc_qa_ok,
        "gate_passed": gate_passed,
    }


@router.get("/status/{ticket_ref}", response_model=SDLCStatusOut)
async def get_sdlc_status(
    ticket_ref: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Get SDLC gate status for a specific ticket."""
    result = await db.execute(select(Ticket).where(Ticket.ticket_ref == ticket_ref))
    ticket = result.scalar_one_or_none()
    
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    return SDLCStatusOut(
        ticket_ref=ticket.ticket_ref,
        routing_target=ticket.routing_target,
        devops_confirmed=ticket.sdlc_devops_ok,
        qa_confirmed=ticket.sdlc_qa_ok,
        gate_passed=ticket.sdlc_devops_ok and ticket.sdlc_qa_ok,
        status=ticket.status,
    )


@router.get("/pending")
async def list_pending_sdlc(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """List all tickets awaiting SDLC dual confirmation."""
    engineering_teams = ["SRE-Team", "DevOps-Team", "Engineering-Team"]
    query = (
        select(Ticket)
        .where(Ticket.routing_target.in_(engineering_teams))
        .where(
            (Ticket.sdlc_devops_ok == False) | (Ticket.sdlc_qa_ok == False)
        )
        .order_by(Ticket.created_at.desc())
    )
    result = await db.execute(query)
    tickets = result.scalars().all()
    
    return {
        "items": [
            {
                "id": t.id,
                "ticket_ref": t.ticket_ref,
                "subject": t.subject,
                "priority": t.priority.value,
                "status": t.status.value,
                "routing_target": t.routing_target,
                "devops_ok": t.sdlc_devops_ok,
                "qa_ok": t.sdlc_qa_ok,
                "created_at": t.created_at.isoformat() if t.created_at else None,
                "sla_deadline": t.sla_deadline.isoformat() if t.sla_deadline else None,
            }
            for t in tickets
        ],
        "total": len(tickets),
    }
