"""
LangGraph orchestration for Phase 1 + Phase 2.
Phase 2 adds conditional branching for ticket splitting, dedup, routing, loop detection, and SDLC gate.
"""
from langgraph.graph import StateGraph, START, END
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.ticket import Ticket, Priority, TicketStatus, SentimentLabel
from app.models.kb_article import KBArticle, KBArticleStatus
from app.models.notification import Notification, NotificationStatus
from .state import AgentState
from app.core.logging import get_logger

logger = get_logger(__name__)
from .agents import (
    # Phase 1
    ag_16_config_validation,
    ag_13_pii_redaction,
    ag_01_intake,
    ag_02_triage,
    ag_06_sla_clocks,
    ag_08_escalation_guard,
    # Phase 2
    ag_11_ticket_splitter,
    ag_03_dedup_linker,
    ag_04_router,
    ag_14_loop_detection,
    ag_09_sdlc_gate,
    # Phase 3
    ag_05_kb_resolution,
    ag_10_kb_generation,
    ag_07_communication,
)


def _should_continue_after_escalation(state: AgentState) -> str:
    """Conditional edge after AG-08: if escalated, skip to END. Otherwise continue to Phase 2 nodes."""
    if state.get("escalate"):
        logger.info("Graph: Escalation detected → routing to END (awaiting HIL)")
        return "end"
    return "continue"


def _should_sdlc_gate(state: AgentState) -> str:
    """Conditional edge after AG-14: route to SDLC gate only for engineering-bound tickets."""
    routing_target = state.get("routing_target", "")
    engineering_teams = {"SRE-Team", "DevOps-Team", "Engineering-Team"}
    if routing_target in engineering_teams:
        return "sdlc"
    return "end"


def _should_continue_after_rag(state: AgentState) -> str:
    """Conditional edge after AG-05 (RAG): if resolved, go to communication. Else continue to escalation guard."""
    if state.get("rag_resolved"):
        logger.info("Graph: Ticket resolved by RAG → routing to Communication")
        return "communication"
    return "continue"


def build_graph():
    logger.info("Building LangGraph orchestration graph (Phase 1 + Phase 2)")
    builder = StateGraph(AgentState)
    
    # ── Phase 1 Nodes ──
    builder.add_node("AG-16_Config_Validation", ag_16_config_validation)
    builder.add_node("AG-13_PII_Redaction", ag_13_pii_redaction)
    builder.add_node("AG-01_Intake", ag_01_intake)
    builder.add_node("AG-02_Triage", ag_02_triage)
    builder.add_node("AG-06_SLA_Clocks", ag_06_sla_clocks)
    builder.add_node("AG-08_Escalation_Guard", ag_08_escalation_guard)
    
    # ── Phase 2 Nodes ──
    builder.add_node("AG-11_Ticket_Splitter", ag_11_ticket_splitter)
    builder.add_node("AG-03_Dedup_Linker", ag_03_dedup_linker)
    builder.add_node("AG-04_Router", ag_04_router)
    builder.add_node("AG-14_Loop_Detection", ag_14_loop_detection)
    builder.add_node("AG-09_SDLC_Gate", ag_09_sdlc_gate)
    
    # ── Phase 3 Nodes ──
    builder.add_node("AG-05_KB_Resolution", ag_05_kb_resolution)
    builder.add_node("AG-10_KB_Generation", ag_10_kb_generation)
    builder.add_node("AG-07_Communication", ag_07_communication)
    
    # ── Phase 1 Edges (linear pipeline) ──
    builder.add_edge(START, "AG-16_Config_Validation")
    builder.add_edge("AG-16_Config_Validation", "AG-13_PII_Redaction")
    builder.add_edge("AG-13_PII_Redaction", "AG-01_Intake")
    builder.add_edge("AG-01_Intake", "AG-02_Triage")
    builder.add_edge("AG-02_Triage", "AG-06_SLA_Clocks")
    
    # Insert Phase 3 RAG Node
    builder.add_edge("AG-06_SLA_Clocks", "AG-05_KB_Resolution")
    
    # Conditional branching after RAG
    builder.add_conditional_edges(
        "AG-05_KB_Resolution",
        _should_continue_after_rag,
        {
            "communication": "AG-07_Communication",
            "continue": "AG-08_Escalation_Guard",
        }
    )
    
    # If resolved by RAG, communication node fires, then ends
    builder.add_edge("AG-07_Communication", END)
    
    # ── Phase 2 Conditional Branching ──
    # After escalation guard: if escalated → END, else → Phase 2 pipeline
    builder.add_conditional_edges(
        "AG-08_Escalation_Guard",
        _should_continue_after_escalation,
        {
            "end": END,
            "continue": "AG-11_Ticket_Splitter",
        }
    )
    
    # Phase 2 linear pipeline
    builder.add_edge("AG-11_Ticket_Splitter", "AG-03_Dedup_Linker")
    builder.add_edge("AG-03_Dedup_Linker", "AG-04_Router")
    builder.add_edge("AG-04_Router", "AG-14_Loop_Detection")
    
    # After loop detection: conditional to SDLC gate or END
    builder.add_conditional_edges(
        "AG-14_Loop_Detection",
        _should_sdlc_gate,
        {
            "sdlc": "AG-09_SDLC_Gate",
            "end": END,
        }
    )
    
    builder.add_edge("AG-09_SDLC_Gate", END)
    
    # Compile
    logger.info("LangGraph compilation complete (11 nodes)")
    return builder.compile()

# Lazily compile graph
csagent_graph = build_graph()


async def process_ticket(ticket_id: int, db: AsyncSession):
    """Run the LangGraph pipeline for a newly submitted ticket and sync state back to DB."""
    from app.models.user import User
    logger.info(f"Processing ticket ID: {ticket_id}")
    result = await db.execute(select(Ticket).where(Ticket.id == ticket_id))
    ticket = result.scalar_one_or_none()
    
    if not ticket:
        logger.warning(f"Ticket ID {ticket_id} not found")
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
        "messages": [],
        # Phase 2 initial state
        "parent_ticket_id": ticket.parent_id,
        "child_ticket_ids": [],
        "has_multiple_issues": False,
        "master_ticket_id": ticket.master_ticket_id,
        "linked_ticket_ids": [],
        "is_duplicate": False,
        "routing_target": ticket.routing_target,
        "routing_history": [],
        "sdlc_devops_confirmed": ticket.sdlc_devops_ok,
        "sdlc_qa_confirmed": ticket.sdlc_qa_ok,
        "sdlc_gate_passed": ticket.sdlc_devops_ok and ticket.sdlc_qa_ok,
        "loop_count": ticket.loop_count,
        # Phase 3 initial state
        "rag_resolved": False,
        "rag_response": None,
        "kb_draft_id": None,
        "portal_reply": None,
        "data_consent_flag": False,
        # Extended
        "is_vip_customer": ticket.is_vip_customer,
        "recurring_issue": ticket.recurring_issue,
        "dedup_conflict": ticket.dedup_conflict_flag,
        "_kb_draft_title": None,
        "_kb_draft_content": None,
    }
    
    # Execute graph
    logger.info(f"Invoking graph for ticket {ticket.ticket_ref}")
    final_state = await csagent_graph.ainvoke(initial_state)
    logger.info(f"Graph execution finished for ticket {ticket.ticket_ref}")
    
    # ── Sync state back to DB ──
    ticket.description = final_state.get("description", ticket.description)
    ticket.category = final_state.get("category", ticket.category)
    ticket.pii_redacted = final_state.get("pii_redacted", ticket.pii_redacted)
    ticket.sla_deadline = final_state.get("sla_deadline", ticket.sla_deadline)
    
    # Phase 2 fields
    ticket.routing_target = final_state.get("routing_target", ticket.routing_target)
    ticket.sdlc_devops_ok = final_state.get("sdlc_devops_confirmed", ticket.sdlc_devops_ok)
    ticket.sdlc_qa_ok = final_state.get("sdlc_qa_confirmed", ticket.sdlc_qa_ok)
    ticket.loop_count = final_state.get("loop_count", ticket.loop_count)
    
    # Extended fields
    ticket.is_vip_customer = final_state.get("is_vip_customer", ticket.is_vip_customer)
    ticket.recurring_issue = final_state.get("recurring_issue", ticket.recurring_issue)
    ticket.dedup_conflict_flag = final_state.get("dedup_conflict", ticket.dedup_conflict_flag)

    # AG-03: link child ticket to master if dedup matched
    resolved_master_id = final_state.get("master_ticket_id")
    if resolved_master_id:
        ticket.master_ticket_id = resolved_master_id
        logger.info(f"Ticket {ticket.ticket_ref} linked to master ID {resolved_master_id}")

    # Persist KB draft produced by AG-10
    kb_draft_content = final_state.get("_kb_draft_content")
    kb_draft_title = final_state.get("_kb_draft_title")
    if kb_draft_title and kb_draft_content:
        article = KBArticle(
            title=kb_draft_title,
            content=kb_draft_content,
            source_ticket_ref=ticket.ticket_ref,
            status=KBArticleStatus.DRAFT,
        )
        db.add(article)
        logger.info(f"Saved KB draft for ticket {ticket.ticket_ref}")

    # Create notification records for consolidated (duplicate) tickets
    if final_state.get("is_duplicate") and final_state.get("linked_ticket_ids"):
        master_ref = final_state.get("linked_ticket_ids")[0]  # first match is the master
        msg = (
            f"Your ticket has been linked to master ticket {master_ref} because it describes "
            f"a known issue. You will receive unified updates on that ticket."
        )
        notif = Notification(
            master_ticket_ref=master_ref,
            child_ticket_ref=ticket.ticket_ref,
            customer_email=ticket.customer_email,
            message=msg,
            status=NotificationStatus.PENDING,
        )
        db.add(notif)
        logger.info(f"Queued consolidation notification for {ticket.customer_email}")
    
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
    logger.info(f"Ticket {ticket.ticket_ref} updated successfully in DB")
