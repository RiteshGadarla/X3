"""
LangGraph state definition for the CSAgent.
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
    
    # LangGraph standard message passing
    messages: Annotated[List[BaseMessage], add_messages]
