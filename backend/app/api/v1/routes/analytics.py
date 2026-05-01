from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.db.session import get_db
from app.core.logging import get_logger
from app.models.ticket import Ticket, TicketStatus, SentimentLabel, Priority
from app.services.langgraph.agents import ag_12_analytics, ag_17_data_consent

logger = get_logger(__name__)
router = APIRouter(prefix="/analytics", tags=["Analytics"])

_DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

async def _build_voc_heatmap(db: AsyncSession) -> list[dict]:
    """Aggregate ticket sentiment counts by day-of-week from the DB."""
    rows = await db.execute(
        select(
            func.strftime("%w", Ticket.created_at).label("dow"),
            Ticket.sentiment,
            func.count(Ticket.id).label("cnt"),
        ).group_by("dow", Ticket.sentiment)
    )
    by_dow: dict[str, dict] = {
        label: {"day": label, "positive": 0, "neutral": 0, "negative": 0, "angry": 0}
        for label in _DOW_LABELS
    }
    for dow_str, sentiment, cnt in rows:
        if dow_str is None:
            continue
        label = _DOW_LABELS[int(dow_str)]
        key = sentiment.value if hasattr(sentiment, "value") else str(sentiment)
        if key in by_dow[label]:
            by_dow[label][key] = cnt
    return [by_dow[d] for d in ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]]


@router.get("/reports")
async def get_analytics_reports(db: AsyncSession = Depends(get_db)):
    """Generate SLA compliance and Sentiment statistics. (AG-12)"""
    try:
        report_data = await ag_12_analytics(db)
        report_data["voc_heatmap"] = await _build_voc_heatmap(db)
        return {"status": "success", "data": report_data}
    except Exception as e:
        logger.error(f"Failed to generate analytics report: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate analytics report.")


@router.get("/executive")
async def get_executive_dashboard(db: AsyncSession = Depends(get_db)):
    """VP Executive summary: KPIs, recurring issues, top sentiment, SLA burn. (UI-11)"""
    try:
        now = datetime.now(timezone.utc)
        thirty_days_ago = now - timedelta(days=30)

        total = await db.scalar(select(func.count(Ticket.id))) or 0
        resolved = await db.scalar(
            select(func.count(Ticket.id)).where(Ticket.status == TicketStatus.RESOLVED)
        ) or 0
        rag_resolved = await db.scalar(
            select(func.count(Ticket.id)).where(Ticket.status == TicketStatus.RESOLVED)
        ) or 0

        fcr_rate = round((rag_resolved / total * 100), 1) if total else 0.0

        sla_breached = await db.scalar(
            select(func.count(Ticket.id))
            .where(Ticket.sla_deadline < now)
            .where(Ticket.status.notin_([TicketStatus.RESOLVED, TicketStatus.CLOSED]))
        ) or 0
        sla_breach_rate = round((sla_breached / total * 100), 1) if total else 0.0

        p1_open = await db.scalar(
            select(func.count(Ticket.id))
            .where(Ticket.priority == Priority.P1)
            .where(Ticket.status.notin_([TicketStatus.RESOLVED, TicketStatus.CLOSED]))
        ) or 0
        p2_open = await db.scalar(
            select(func.count(Ticket.id))
            .where(Ticket.priority == Priority.P2)
            .where(Ticket.status.notin_([TicketStatus.RESOLVED, TicketStatus.CLOSED]))
        ) or 0

        escalated = await db.scalar(
            select(func.count(Ticket.id))
            .where(Ticket.status.in_([TicketStatus.ESCALATED, TicketStatus.PENDING_HIL]))
        ) or 0

        angry = await db.scalar(
            select(func.count(Ticket.id)).where(Ticket.sentiment == SentimentLabel.ANGRY)
        ) or 0

        recurring_rows = await db.execute(
            select(Ticket.category, func.count(Ticket.id).label("cnt"))
            .where(Ticket.created_at >= thirty_days_ago)
            .where(Ticket.recurring_issue == True)  # noqa: E712
            .group_by(Ticket.category)
            .order_by(func.count(Ticket.id).desc())
            .limit(5)
        )
        recurring_issues = [
            {"category": row.category, "count": row.cnt}
            for row in recurring_rows
        ]

        voc_heatmap = await _build_voc_heatmap(db)

        return {
            "status": "success",
            "data": {
                "total_tickets": total,
                "resolved_tickets": resolved,
                "fcr_rate_percent": fcr_rate,
                "sla_breach_rate_percent": sla_breach_rate,
                "sla_breached_active": sla_breached,
                "p1_open": p1_open,
                "p2_open": p2_open,
                "escalated_pending": escalated,
                "angry_customers": angry,
                "top_recurring_issues": recurring_issues,
                "voc_heatmap": voc_heatmap,
            }
        }
    except Exception as e:
        logger.error(f"Failed to generate executive dashboard: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate executive dashboard.")


@router.post("/sweep")
async def trigger_data_consent_sweep(db: AsyncSession = Depends(get_db)):
    """Trigger the 7-year data retention sweep manually. (AG-17)"""
    try:
        result = await ag_17_data_consent(db)
        return {
            "status": "success",
            "message": "Data consent sweep executed successfully.",
            "details": result
        }
    except Exception as e:
        logger.error(f"Failed to execute data consent sweep: {e}")
        raise HTTPException(status_code=500, detail="Failed to execute data consent sweep.")
