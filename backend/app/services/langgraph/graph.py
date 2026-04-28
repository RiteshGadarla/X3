"""
LangGraph orchestration for Phase 1.
"""
from langgraph.graph import StateGraph, START, END
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.ticket import Ticket, Priority, TicketStatus, SentimentLabel
from .state import AgentState
from .agents import (
    ag_16_config_validation,
    ag_13_pii_redaction,
    ag_01_intake,
    ag_02_triage,
    ag_06_sla_clocks,
    ag_08_escalation_guard
)

def build_graph():
    builder = StateGraph(AgentState)
    
    # Add nodes
    builder.add_node("AG-16_Config_Validation", ag_16_config_validation)
    builder.add_node("AG-13_PII_Redaction", ag_13_pii_redaction)
    builder.add_node("AG-01_Intake", ag_01_intake)
    builder.add_node("AG-02_Triage", ag_02_triage)
    builder.add_node("AG-06_SLA_Clocks", ag_06_sla_clocks)
    builder.add_node("AG-08_Escalation_Guard", ag_08_escalation_guard)
    
    # Build edges
    builder.add_edge(START, "AG-16_Config_Validation")
    builder.add_edge("AG-16_Config_Validation", "AG-13_PII_Redaction")
    builder.add_edge("AG-13_PII_Redaction", "AG-01_Intake")
    builder.add_edge("AG-01_Intake", "AG-02_Triage")
    builder.add_edge("AG-02_Triage", "AG-06_SLA_Clocks")
    builder.add_edge("AG-06_SLA_Clocks", "AG-08_Escalation_Guard")
    builder.add_edge("AG-08_Escalation_Guard", END)
    
    # Compile
    return builder.compile()

# Lazily compile graph
csagent_graph = build_graph()


async def process_ticket(ticket_id: int, db: AsyncSession):
    """
    Run the LangGraph pipeline for a newly submitted ticket.
    Updates the database with the results.
    """
    # Fetch ticket
    result = await db.execute(select(Ticket).where(Ticket.id == ticket_id))
    ticket = result.scalar_one_or_none()
    
    if not ticket:
        return
        
    initial_state: AgentState = {
        "ticket_id": ticket.id,
        "ticket_ref": ticket.ticket_ref,
        "customer_email": ticket.customer_email,
        "subject": ticket.subject,
        "description": ticket.description,
        "category": ticket.category,
        "priority": ticket.priority.value,
        "status": ticket.status.value,
        "sentiment": ticket.sentiment.value,
        "pii_redacted": ticket.pii_redacted,
        "escalate": False,
        "sla_deadline": ticket.sla_deadline,
        "error": None,
        "messages": []
    }
    
    # Execute graph
    final_state = await csagent_graph.ainvoke(initial_state)
    
    # Sync state back to DB
    ticket.description = final_state.get("description", ticket.description)
    ticket.category = final_state.get("category", ticket.category)
    ticket.pii_redacted = final_state.get("pii_redacted", ticket.pii_redacted)
    ticket.sla_deadline = final_state.get("sla_deadline", ticket.sla_deadline)
    
    # Enums handling
    try:
        ticket.priority = Priority(final_state.get("priority", ticket.priority.value))
    except ValueError:
        pass
        
    try:
        ticket.status = TicketStatus(final_state.get("status", ticket.status.value))
    except ValueError:
        pass
        
    try:
        ticket.sentiment = SentimentLabel(final_state.get("sentiment", ticket.sentiment.value))
    except ValueError:
        pass

    db.add(ticket)
    await db.commit()
