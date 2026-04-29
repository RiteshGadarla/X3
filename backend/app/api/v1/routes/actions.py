"""
Action/Command routes — Phase 2
Extensible JSON-based action system for future avatar/button API integration.
Designed to accept commands like {"action": "filter_tickets", "params": {"status": "angry"}}
and map them to backend operations.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.db.session import get_db
from app.models.ticket import Ticket, TicketStatus, Priority, SentimentLabel
from app.models.user import User
from app.schemas.ticket import ActionCommand, ActionResult
from app.api.deps import get_current_user
from app.core.logging import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/actions", tags=["Actions"])


# ── Action Registry ──
# Maps action names to handler functions. New actions can be added here.
# This is the hook point for future avatar voice commands.

async def _action_filter_tickets(params: dict, db: AsyncSession) -> dict:
    """Filter tickets by status, priority, sentiment, or routing target."""
    query = select(Ticket)
    
    if "status" in params:
        try:
            query = query.where(Ticket.status == TicketStatus(params["status"]))
        except ValueError:
            pass
    
    if "priority" in params:
        try:
            query = query.where(Ticket.priority == Priority(params["priority"]))
        except ValueError:
            pass
    
    if "sentiment" in params:
        # Support "angry" as a special filter
        try:
            query = query.where(Ticket.sentiment == SentimentLabel(params["sentiment"]))
        except ValueError:
            pass
    
    if "routing_target" in params:
        query = query.where(Ticket.routing_target == params["routing_target"])
    
    query = query.order_by(Ticket.created_at.desc()).limit(params.get("limit", 50))
    result = await db.execute(query)
    tickets = result.scalars().all()
    
    return {
        "tickets": [
            {
                "id": t.id,
                "ticket_ref": t.ticket_ref,
                "subject": t.subject,
                "priority": t.priority.value,
                "status": t.status.value,
                "sentiment": t.sentiment.value,
                "routing_target": t.routing_target,
                "category": t.category,
            }
            for t in tickets
        ],
        "count": len(tickets),
    }


async def _action_get_ticket_detail(params: dict, db: AsyncSession) -> dict:
    """Get full ticket details by ID or ticket_ref."""
    ticket = None
    if "ticket_id" in params:
        result = await db.execute(select(Ticket).where(Ticket.id == int(params["ticket_id"])))
        ticket = result.scalar_one_or_none()
    elif "ticket_ref" in params:
        result = await db.execute(select(Ticket).where(Ticket.ticket_ref == params["ticket_ref"]))
        ticket = result.scalar_one_or_none()
    
    if not ticket:
        return {"error": "Ticket not found"}
    
    return {
        "id": ticket.id,
        "ticket_ref": ticket.ticket_ref,
        "subject": ticket.subject,
        "description": ticket.description,
        "priority": ticket.priority.value,
        "status": ticket.status.value,
        "sentiment": ticket.sentiment.value,
        "category": ticket.category,
        "routing_target": ticket.routing_target,
        "sdlc_devops_ok": ticket.sdlc_devops_ok,
        "sdlc_qa_ok": ticket.sdlc_qa_ok,
        "parent_id": ticket.parent_id,
        "master_ticket_id": ticket.master_ticket_id,
        "created_at": ticket.created_at.isoformat() if ticket.created_at else None,
        "sla_deadline": ticket.sla_deadline.isoformat() if ticket.sla_deadline else None,
    }


async def _action_get_stats(params: dict, db: AsyncSession) -> dict:
    """Get ticket statistics summary."""
    total = await db.execute(select(func.count(Ticket.id)))
    by_status = {}
    for status in TicketStatus:
        count = await db.execute(
            select(func.count(Ticket.id)).where(Ticket.status == status)
        )
        by_status[status.value] = count.scalar_one()
    
    by_priority = {}
    for priority in Priority:
        count = await db.execute(
            select(func.count(Ticket.id)).where(Ticket.priority == priority)
        )
        by_priority[priority.value] = count.scalar_one()
    
    return {
        "total": total.scalar_one(),
        "by_status": by_status,
        "by_priority": by_priority,
    }


async def _action_approve_sdlc(params: dict, db: AsyncSession) -> dict:
    """Manually approve SDLC gate (DevOps or QA)."""
    ticket_ref = params.get("ticket_ref")
    source = params.get("source")  # "devops" or "qa"
    
    if not ticket_ref or not source:
        return {"error": "ticket_ref and source (devops/qa) are required"}
    
    result = await db.execute(select(Ticket).where(Ticket.ticket_ref == ticket_ref))
    ticket = result.scalar_one_or_none()
    
    if not ticket:
        return {"error": f"Ticket {ticket_ref} not found"}
    
    if source == "devops":
        ticket.sdlc_devops_ok = True
    elif source == "qa":
        ticket.sdlc_qa_ok = True
    else:
        return {"error": "source must be 'devops' or 'qa'"}
    
    gate_passed = ticket.sdlc_devops_ok and ticket.sdlc_qa_ok
    if gate_passed and ticket.status == TicketStatus.IN_PROGRESS:
        ticket.status = TicketStatus.RESOLVED
    
    await db.flush()
    await db.refresh(ticket)
    
    return {
        "ticket_ref": ticket_ref,
        "devops_ok": ticket.sdlc_devops_ok,
        "qa_ok": ticket.sdlc_qa_ok,
        "gate_passed": gate_passed,
        "status": ticket.status.value,
    }


# Action handler registry
ACTION_HANDLERS = {
    "filter_tickets": _action_filter_tickets,
    "get_ticket_detail": _action_get_ticket_detail,
    "get_stats": _action_get_stats,
    "approve_sdlc": _action_approve_sdlc,
}


@router.post("/execute", response_model=ActionResult)
async def execute_action(
    command: ActionCommand,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Execute a JSON-based action command.
    This endpoint is the hook point for future avatar/voice integration.
    Commands can also be triggered by UI buttons via the action API.
    
    Supported actions:
    - filter_tickets: {status?, priority?, sentiment?, routing_target?, limit?}
    - get_ticket_detail: {ticket_id? | ticket_ref?}
    - get_stats: {}
    - approve_sdlc: {ticket_ref, source: "devops"|"qa"}
    """
    logger.info(f"Action executed: {command.action} with params: {command.params}")
    
    handler = ACTION_HANDLERS.get(command.action)
    if not handler:
        available = list(ACTION_HANDLERS.keys())
        return ActionResult(
            success=False,
            action=command.action,
            error=f"Unknown action '{command.action}'. Available: {available}",
        )
    
    try:
        result = await handler(command.params, db)
        return ActionResult(success=True, action=command.action, result=result)
    except Exception as e:
        logger.error(f"Action '{command.action}' failed: {str(e)}")
        return ActionResult(success=False, action=command.action, error=str(e))


@router.get("/available")
async def list_available_actions(_: User = Depends(get_current_user)):
    """List all available action commands with descriptions."""
    return {
        "actions": [
            {"name": "filter_tickets", "description": "Filter tickets by status, priority, sentiment, routing_target", "params": ["status", "priority", "sentiment", "routing_target", "limit"]},
            {"name": "get_ticket_detail", "description": "Get full ticket details", "params": ["ticket_id", "ticket_ref"]},
            {"name": "get_stats", "description": "Get ticket statistics summary", "params": []},
            {"name": "approve_sdlc", "description": "Manually approve SDLC gate", "params": ["ticket_ref", "source"]},
        ]
    }
