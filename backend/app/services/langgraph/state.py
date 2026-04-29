"""
LangGraph state definition for the CSAgent.
Phase 2: Extended with ticket splitting, dedup linking, routing, SDLC gate, and loop detection.
"""

from typing import TypedDict, Annotated, List, Optional
from datetime import datetime
from langgraph.graph.message import add_messages
from langchain_core.messages import BaseMessage


class AgentState(TypedDict):
    ticket_id: int
    ticket_ref: str
    customer_email: str
    subject: str
    description: str
    category: str
    priority: str
    status: str
    sentiment: str
    pii_redacted: bool
    escalate: bool
    sla_deadline: Optional[datetime]
    error: Optional[str]

    # ── Phase 2: Ticket Splitting (AG-11) ──
    parent_ticket_id: Optional[int]
    child_ticket_ids: List[int]
    has_multiple_issues: bool

    # ── Phase 2: Dedup Linking (AG-03) ──
    master_ticket_id: Optional[int]
    linked_ticket_ids: List[int]
    is_duplicate: bool

    # ── Phase 2: Routing (AG-04) ──
    routing_target: Optional[str]
    routing_history: List[str]

    # ── Phase 2: SDLC Gate (AG-09) ──
    sdlc_devops_confirmed: bool
    sdlc_qa_confirmed: bool
    sdlc_gate_passed: bool

    # ── Phase 2: Loop Detection (AG-14) ──
    loop_count: int

    # ── Phase 3: RAG, KB & Analytics ──
    rag_resolved: bool
    rag_response: Optional[str]
    kb_draft_id: Optional[int]
    portal_reply: Optional[str]
    data_consent_flag: bool

    # LangGraph standard message passing
    messages: Annotated[List[BaseMessage], add_messages]
