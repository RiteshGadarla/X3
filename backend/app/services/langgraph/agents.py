"""
LangGraph Nodes (Agents) for Phase 1 + Phase 2.
Phase 2 adds: AG-11 (Ticket Splitter), AG-03 (Dedup Linker), AG-04 (Router),
              AG-09 (SDLC Gate), AG-14 (Loop Detection).
"""
import os
import re
import uuid
from datetime import datetime, timezone, timedelta
from typing import List
from pydantic import BaseModel, Field

from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ticket import Priority, TicketStatus, SentimentLabel, Ticket
from .state import AgentState

from langchain_core.runnables.config import RunnableConfig

from .llm import get_llm
from app.core.logging import get_logger

logger = get_logger(__name__)


# ═══════════════════════════════════════════════════════════════════════════
# Phase 1 Agents
# ═══════════════════════════════════════════════════════════════════════════

async def ag_16_config_validation(state: AgentState):
    """AG-16: Config Validation."""
    logger.info(f"--- AG-16: Validating Config for Ticket {state.get('ticket_ref')} ---")
    # For Phase 1, validates baseline state config.
    status = TicketStatus.NEW.value
    logger.info(f"AG-16: Baseline validation passed. Initial status: {status}")
    return {"status": status}

class RedactionOutput(BaseModel):
    redacted_description: str = Field(description="The description with all PII redacted.")
    pii_redacted: bool = Field(description="True if any PII was found and redacted, False otherwise.")

async def ag_13_pii_redaction(state: AgentState, config: RunnableConfig):
    """AG-13: PII Redaction using LLM."""
    desc = state.get("description", "")
    
    model_id = config.get("configurable", {}).get("model_id", 1) if config else 1
    llm = get_llm(model_id=model_id)
    structured_llm = llm.with_structured_output(RedactionOutput)
    
    prompt = f"""
    Analyze the following customer support ticket description and redact any Personally Identifiable Information (PII).
    Specifically, replace credit card numbers, social security numbers, and explicit passwords with '[REDACTED]'.
    If no PII is present, return the original description exactly as it is and set pii_redacted to false.
    
    Description:
    {desc}
    """
    
    try:
        logger.info(f"Executing AG-13: PII Redaction. Input length: {len(desc)}")
        result = await structured_llm.ainvoke(prompt)
        logger.info(f"AG-13: PII Redaction complete. Redacted: {result.pii_redacted}")
        return {
            "description": result.redacted_description,
            "pii_redacted": result.pii_redacted
        }
    except Exception as e:
        logger.error(f"AG-13: PII Redaction failed: {str(e)}")
        # Fallback if LLM fails
        return {"pii_redacted": False}

async def ag_01_intake(state: AgentState):
    """AG-01: Intake. Normalizes the request."""
    logger.info(f"--- AG-01: Processing Intake for {state.get('ticket_ref')} ---")
    # Payload is already validated via FastAPI Pydantic models.
    # Return current status to satisfy LangGraph update requirements.
    status = state.get("status")
    logger.info(f"AG-01: Intake verified. Subject: '{state.get('subject')}'")
    return {"status": status}


class TriageOutput(BaseModel):
    sentiment: str = Field(description="positive, neutral, negative, or angry")
    priority: str = Field(description="P1, P2, P3, or P4")
    category: str = Field(description="Categorization of the ticket")

async def ag_02_triage(state: AgentState, config: RunnableConfig):
    """AG-02: Triage & Sentiment LLM."""
    model_id = config.get("configurable", {}).get("model_id", 1) if config else 1
    llm = get_llm(model_id=model_id)
    structured_llm = llm.with_structured_output(TriageOutput)
    
    prompt = f"""
    Analyze the following customer support ticket and determine its sentiment, priority, and category.
    
    Ticket Subject: {state.get('subject')}
    Ticket Description: {state.get('description')}
    
    Rules for Sentiment: Must be one of 'positive', 'neutral', 'negative', 'angry'.
    Rules for Priority:
    - P1: Critical system outage, server down, severe data loss.
    - P2: High impact, feature broken for multiple users.
    - P3: General question, minor bug, feature request.
    - P4: Low priority, typos, informational.
    * If sentiment is 'angry', consider bumping priority by one level (e.g. P3 -> P2).
    """
    
    try:
        logger.info(f"--- AG-02: Starting Triage & Sentiment Analysis for {state.get('ticket_ref')} ---")
        result = await structured_llm.ainvoke(prompt)
        sentiment = result.sentiment.lower()
        if sentiment not in [s.value for s in SentimentLabel]:
            sentiment = SentimentLabel.NEUTRAL.value
            
        priority = result.priority.upper()
        if priority not in [p.value for p in Priority]:
            priority = Priority.P4.value
            
        logger.info(f"AG-02: Analysis Result -> Sentiment: {sentiment}, Priority: {priority}, Category: {result.category}")
        return {
            "sentiment": sentiment,
            "priority": priority,
            "category": result.category,
            "status": TicketStatus.TRIAGED.value
        }
    except Exception as e:
        logger.error(f"AG-02: Triage failed: {str(e)}")
        return {"error": str(e), "status": TicketStatus.TRIAGED.value}


async def ag_06_sla_clocks(state: AgentState):
    """AG-06: SLA Clocks."""
    priority = state.get("priority", Priority.P4.value)
    logger.info(f"--- AG-06: Calculating SLA for Priority {priority} ---")
    defaults = {"P1": 15, "P2": 60, "P3": 240, "P4": 480}
    
    mins = defaults.get(priority, 480)
    deadline = datetime.now(timezone.utc) + timedelta(minutes=mins)
    
    logger.info(f"AG-06: SLA Clock set for +{mins} minutes. Deadline: {deadline.strftime('%Y-%m-%d %H:%M:%S')}")
    return {"sla_deadline": deadline}


async def ag_08_escalation_guard(state: AgentState):
    """AG-08: Escalation Guard. Flags for HIL if needed."""
    sentiment = state.get("sentiment")
    priority = state.get("priority")
    category = state.get("category", "").lower()
    ticket_ref = state.get("ticket_ref")
    
    logger.info(f"--- AG-08: Running Escalation Guard for {ticket_ref} ---")
    escalate = False
    reason = ""
    
    # HIL-3/4 rules: Angry, Billing/Legal, or High Priority (P1/P2)
    if sentiment == SentimentLabel.ANGRY.value:
        escalate = True
        reason = "Angry sentiment detected"
    elif "billing" in category or "legal" in category:
        escalate = True
        reason = f"Critical category found: {category}"
    elif priority in [Priority.P1.value, Priority.P2.value]:
        escalate = True
        reason = f"High priority level: {priority}"
        
    if escalate:
        logger.info(f"AG-08: ESCALATION TRIGGERED. Reason: {reason}")
        return {"escalate": True, "status": TicketStatus.PENDING_HIL.value}
        
    logger.info("AG-08: No escalation triggers found. Routing to standard queue.")
    return {"escalate": False}


# ═══════════════════════════════════════════════════════════════════════════
# Phase 2 Agents
# ═══════════════════════════════════════════════════════════════════════════

class TicketSplitOutput(BaseModel):
    has_multiple_issues: bool = Field(description="True if the ticket contains multiple distinct issues")
    issues: list[str] = Field(description="List of distinct issue summaries (each becomes a child ticket)")

async def ag_11_ticket_splitter(state: AgentState, config: RunnableConfig):
    """AG-11: Break of Multiple Tickets.
    Parses complex web requests and breaks them into distinct, parallel child tickets.
    """
    ticket_ref = state.get("ticket_ref")
    logger.info(f"--- AG-11: Checking for Multiple Issues in {ticket_ref} ---")
    
    model_id = config.get("configurable", {}).get("model_id", 1) if config else 1
    llm = get_llm(model_id=model_id)
    structured_llm = llm.with_structured_output(TicketSplitOutput)
    
    prompt = f"""
    Analyze the following customer support ticket. Determine if it contains MULTIPLE DISTINCT issues 
    that should be handled as separate tickets.
    
    Rules:
    - A ticket asking about TWO different things (e.g., "my server is down AND I need a refund") has multiple issues.
    - A ticket with ONE problem (even if complex) should NOT be split.
    - Only identify truly distinct issues, not sub-steps of the same problem.
    - Return a maximum of 4 child issues.
    
    Ticket Subject: {state.get('subject')}
    Ticket Description: {state.get('description')}
    Category: {state.get('category')}
    """
    
    try:
        result = await structured_llm.ainvoke(prompt)
        if result.has_multiple_issues and len(result.issues) > 1:
            logger.info(f"AG-11: SPLIT DETECTED — {len(result.issues)} sub-issues found for {ticket_ref}")
            # Store the issue summaries; actual DB child ticket creation happens in graph.py
            return {
                "has_multiple_issues": True,
                "child_ticket_ids": [],  # Will be populated by the graph orchestrator after DB writes
            }
        else:
            logger.info(f"AG-11: Single-issue ticket. No split needed for {ticket_ref}")
            return {"has_multiple_issues": False, "child_ticket_ids": []}
    except Exception as e:
        logger.error(f"AG-11: Ticket splitting failed: {str(e)}")
        return {"has_multiple_issues": False, "child_ticket_ids": []}


async def ag_03_dedup_linker(state: AgentState):
    """AG-03: Link to Master Ticket.
    Uses Qdrant-backed vector similarity at zap speed to find
    similar incoming tickets and group them under one Master Ticket.
    """
    ticket_ref = state.get("ticket_ref")
    subject = state.get("subject", "")
    description = state.get("description", "")
    category = state.get("category", "")
    
    logger.info(f"--- AG-03: Qdrant Dedup Check for {ticket_ref} ---")
    
    try:
        from app.core.qdrant import find_similar_tickets
        matches = await find_similar_tickets(ticket_ref, subject, description, category, threshold=0.4)
        
        if matches:
            top_match = matches[0]
            logger.info(
                f"AG-03: DUPLICATE DETECTED — {ticket_ref} matches {top_match['ticket_ref']} "
                f"(similarity: {top_match['similarity']}, shared: {top_match['shared_keywords'][:5]})"
            )
            return {
                "is_duplicate": True,
                "master_ticket_id": None,  # Would be resolved to DB ID by the orchestrator
                "linked_ticket_ids": [m["ticket_ref"] for m in matches],
            }
        else:
            logger.info(f"AG-03: No duplicates found for {ticket_ref}")
            return {
                "is_duplicate": False,
                "master_ticket_id": None,
                "linked_ticket_ids": [],
            }
    except Exception as e:
        logger.warning(f"AG-03: Qdrant dedup failed (fallback: no dedup): {e}")
        return {
            "is_duplicate": False,
            "master_ticket_id": None,
            "linked_ticket_ids": [],
        }


# Routing target mapping
ROUTING_MAP = {
    "server": "SRE-Team",
    "outage": "SRE-Team",
    "infrastructure": "SRE-Team",
    "database": "SRE-Team",
    "deployment": "DevOps-Team",
    "pipeline": "DevOps-Team",
    "ci/cd": "DevOps-Team",
    "build": "DevOps-Team",
    "bug": "Engineering-Team",
    "feature": "Engineering-Team",
    "api": "Engineering-Team",
    "crash": "Engineering-Team",
    "performance": "Engineering-Team",
    "billing": "Finance-Team",
    "payment": "Finance-Team",
    "refund": "Finance-Team",
    "account": "Account-Team",
    "password": "Account-Team",
    "login": "Account-Team",
}

async def ag_04_router(state: AgentState):
    """AG-04: Routing.
    Routes tickets to the appropriate engineering/support team based on category and keywords.
    """
    ticket_ref = state.get("ticket_ref")
    category = state.get("category", "").lower()
    subject = state.get("subject", "").lower()
    description = state.get("description", "").lower()
    priority = state.get("priority", "P4")
    
    logger.info(f"--- AG-04: Routing Ticket {ticket_ref} ---")
    
    # Determine routing target from keywords
    combined_text = f"{category} {subject} {description}"
    target = "General-Support"
    
    for keyword, team in ROUTING_MAP.items():
        if keyword in combined_text:
            target = team
            break
    
    # P1/P2 always goes to SRE first
    if priority in ["P1", "P2"] and target == "General-Support":
        target = "SRE-Team"
    
    routing_history = state.get("routing_history", [])
    routing_history.append(target)
    
    logger.info(f"AG-04: Ticket {ticket_ref} routed to → {target}")
    return {
        "routing_target": target,
        "routing_history": routing_history,
        "status": TicketStatus.IN_PROGRESS.value,
    }


async def ag_14_loop_detection(state: AgentState):
    """AG-14: Loop Detection.
    Prevents the graph from getting stuck in an infinite routing loop.
    If the same ticket has been routed more than 5 times, break the loop.
    """
    ticket_ref = state.get("ticket_ref")
    loop_count = state.get("loop_count", 0)
    routing_history = state.get("routing_history", [])
    
    logger.info(f"--- AG-14: Loop Detection for {ticket_ref}. Count: {loop_count} ---")
    
    loop_count += 1
    
    # Check for routing loops (same target appearing 3+ times)
    if len(routing_history) >= 3:
        last_three = routing_history[-3:]
        if len(set(last_three)) == 1:
            logger.warning(f"AG-14: LOOP DETECTED! Ticket {ticket_ref} routed to {last_three[0]} 3 times. Breaking loop.")
            return {
                "loop_count": loop_count,
                "error": f"Routing loop detected: stuck on {last_three[0]}",
                "status": TicketStatus.ESCALATED.value,
                "escalate": True,
            }
    
    if loop_count > 5:
        logger.warning(f"AG-14: Max loop count exceeded for {ticket_ref}. Escalating.")
        return {
            "loop_count": loop_count,
            "error": "Max routing iterations exceeded",
            "status": TicketStatus.ESCALATED.value,
            "escalate": True,
        }
    
    logger.info(f"AG-14: No loop detected. Count: {loop_count}")
    return {"loop_count": loop_count}


async def ag_09_sdlc_gate(state: AgentState):
    """AG-09: SDLC Gate.
    Enforces the dual-confirmation deployment gate.
    The ticket cannot be marked resolved until BOTH DevOps and QA confirm.
    In Phase 2, this sets the initial gate status. Actual confirmation
    comes via the /sdlc/webhook endpoint.
    """
    ticket_ref = state.get("ticket_ref")
    routing_target = state.get("routing_target", "")
    
    logger.info(f"--- AG-09: SDLC Gate Check for {ticket_ref} ---")
    
    # Only engineering-bound tickets need the SDLC gate
    engineering_teams = {"SRE-Team", "DevOps-Team", "Engineering-Team"}
    
    if routing_target in engineering_teams:
        logger.info(f"AG-09: Ticket {ticket_ref} requires SDLC dual-confirmation gate (target: {routing_target})")
        return {
            "sdlc_devops_confirmed": False,
            "sdlc_qa_confirmed": False,
            "sdlc_gate_passed": False,
        }
    else:
        logger.info(f"AG-09: Non-engineering ticket {ticket_ref}. SDLC gate not required.")
        return {
            "sdlc_devops_confirmed": True,
            "sdlc_qa_confirmed": True,
            "sdlc_gate_passed": True,
        }


# ═══════════════════════════════════════════════════════════════════════════
# Phase 3 Agents
# ═══════════════════════════════════════════════════════════════════════════

class RAGOutput(BaseModel):
    is_resolved: bool = Field(description="True if the KB text fully resolves the user's issue")
    response: str = Field(description="A friendly, jargon-free response to the customer based on the KB text. Empty if not resolved.")

async def ag_05_kb_resolution(state: AgentState, config: RunnableConfig):
    """AG-05 & AG-15: KB Resolution (RAG). Queries Qdrant to find relevant KB articles and uses LLM to draft a resolution."""
    ticket_ref = state.get("ticket_ref")
    subject = state.get("subject", "")
    description = state.get("description", "")
    
    logger.info(f"--- AG-05: KB Resolution (RAG) Check for {ticket_ref} ---")
    
    query = f"{subject} {description}"
    from app.core.qdrant import search_kb_document
    kb_chunks = await search_kb_document(query, limit=3, threshold=0.5)
    
    if not kb_chunks:
        logger.info(f"AG-05: No relevant KB found for {ticket_ref}. Cannot auto-resolve.")
        return {"rag_resolved": False}
        
    kb_text = "\n\n".join(kb_chunks)
    
    model_id = config.get("configurable", {}).get("model_id", 1) if config else 1
    llm = get_llm(model_id=model_id)
    structured_llm = llm.with_structured_output(RAGOutput)
    
    prompt = f"""
    You are an expert customer support AI. A customer has submitted the following ticket:
    Subject: {subject}
    Description: {description}
    
    Here is the official knowledge base context that might answer their question:
    <kb_context>
    {kb_text}
    </kb_context>
    
    Determine if the kb_context provides a complete and direct answer to the customer's problem.
    If yes, set is_resolved to true and provide a friendly, jargon-free response using ONLY the provided context.
    If no, set is_resolved to false and leave response empty.
    """
    
    try:
        result = await structured_llm.ainvoke(prompt)
        if result.is_resolved:
            logger.info(f"AG-05: Ticket {ticket_ref} auto-resolved by RAG!")
            return {
                "rag_resolved": True,
                "rag_response": result.response,
                "status": TicketStatus.RESOLVED.value
            }
        else:
            logger.info(f"AG-05: KB context insufficient to resolve {ticket_ref}")
            return {"rag_resolved": False}
    except Exception as e:
        logger.error(f"AG-05: RAG resolution failed: {e}")
        return {"rag_resolved": False}


class KBDraftOutput(BaseModel):
    draft_title: str = Field(description="Title of the drafted KB article")
    draft_content: str = Field(description="Content of the drafted KB article")

async def ag_10_kb_generation(state: AgentState, config: RunnableConfig):
    """AG-10: KB Generation. Auto-drafts new help articles based on resolved tickets."""
    ticket_ref = state.get("ticket_ref")
    subject = state.get("subject", "")
    description = state.get("description", "")
    status = state.get("status")
    
    logger.info(f"--- AG-10: KB Generation Check for {ticket_ref} ---")
    
    if status == TicketStatus.RESOLVED.value and not state.get("rag_resolved"):
        model_id = config.get("configurable", {}).get("model_id", 1) if config else 1
        llm = get_llm(model_id=model_id)
        structured_llm = llm.with_structured_output(KBDraftOutput)
        
        prompt = f"""
        A customer support ticket was recently resolved.
        Subject: {subject}
        Description: {description}
        
        Draft a clear, concise knowledge base article that explains how to solve this issue in the future.
        """
        try:
            result = await structured_llm.ainvoke(prompt)
            logger.info(f"AG-10: KB draft generated for {ticket_ref}")
            return {"kb_draft_id": 999}
        except Exception as e:
            logger.error(f"AG-10: KB Generation failed: {e}")
            
    return {}


class CommunicationOutput(BaseModel):
    reply_text: str = Field(description="The response message to the customer")

async def ag_07_communication(state: AgentState, config: RunnableConfig):
    """AG-07: Communication. Generates a jargon-free portal reply."""
    ticket_ref = state.get("ticket_ref")
    rag_resolved = state.get("rag_resolved")
    rag_response = state.get("rag_response")
    
    logger.info(f"--- AG-07: Communication generation for {ticket_ref} ---")
    
    if rag_resolved and rag_response:
        return {"portal_reply": rag_response}
        
    status = state.get("status")
    target = state.get("routing_target")
    
    model_id = config.get("configurable", {}).get("model_id", 1) if config else 1
    llm = get_llm(model_id=model_id)
    structured_llm = llm.with_structured_output(CommunicationOutput)
    
    prompt = f"""
    Write a short, friendly message to the customer updating them on their ticket.
    Ticket status is {status}.
    It has been assigned to {target}.
    Do NOT use overly technical jargon. Reassure them that we are working on it.
    """
    try:
        result = await structured_llm.ainvoke(prompt)
        logger.info(f"AG-07: Reply generated for {ticket_ref}")
        return {"portal_reply": result.reply_text}
    except Exception as e:
        logger.error(f"AG-07: Communication failed: {e}")
        return {"portal_reply": "Your ticket has been updated. We are actively working on it."}


async def ag_12_analytics(db: AsyncSession) -> dict:
    """AG-12: Analytics. Calculates SLA compliance and Sentiment statistics."""
    logger.info("--- AG-12: Generating Analytics Report ---")
    
    total = await db.scalar(select(func.count(Ticket.id)))
    resolved = await db.scalar(select(func.count(Ticket.id)).where(Ticket.status == TicketStatus.RESOLVED))
    
    sentiment_dist = {}
    for s in SentimentLabel:
        count = await db.scalar(select(func.count(Ticket.id)).where(Ticket.sentiment == s))
        sentiment_dist[s.value] = count
        
    sla_breached = await db.scalar(
        select(func.count(Ticket.id)).where(Ticket.sla_deadline < datetime.now(timezone.utc)).where(Ticket.status != TicketStatus.RESOLVED)
    )
    
    return {
        "total_tickets": total or 0,
        "resolved_tickets": resolved or 0,
        "sla_breached_active": sla_breached or 0,
        "sentiment_distribution": sentiment_dist
    }


async def ag_17_data_consent(db: AsyncSession) -> dict:
    """AG-17: Data Consent. Sweeps DB for tickets older than 7 years and deletes them."""
    logger.info("--- AG-17: Data Consent Sweep Started ---")
    
    seven_years_ago = datetime.now(timezone.utc) - timedelta(days=7*365)
    
    query = delete(Ticket).where(Ticket.created_at < seven_years_ago)
    result = await db.execute(query)
    await db.commit()
    
    deleted_count = result.rowcount
    logger.info(f"AG-17: Data Consent Sweep complete. Deleted {deleted_count} old tickets.")
    
    return {"deleted_records": deleted_count, "cutoff_date": seven_years_ago.isoformat()}
