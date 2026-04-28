"""
LangGraph Nodes (Agents) for Phase 1.
"""
import os
import re
from datetime import datetime, timezone, timedelta
from langchain_google_genai import ChatGoogleGenerativeAI
from pydantic import BaseModel, Field

from app.models.ticket import Priority, TicketStatus, SentimentLabel
from .state import AgentState

from langchain_core.runnables.config import RunnableConfig

def get_llm(model_name: str = "gemini-1.5-flash"):
    return ChatGoogleGenerativeAI(model=model_name, temperature=0)

async def ag_16_config_validation(state: AgentState):
    """AG-16: Config Validation."""
    # For Phase 1, validates baseline state config.
    return {"status": TicketStatus.NEW.value}

class RedactionOutput(BaseModel):
    redacted_description: str = Field(description="The description with all PII redacted.")
    pii_redacted: bool = Field(description="True if any PII was found and redacted, False otherwise.")

async def ag_13_pii_redaction(state: AgentState, config: RunnableConfig):
    """AG-13: PII Redaction using LLM."""
    desc = state.get("description", "")
    
    model_name = config.get("configurable", {}).get("model_name", "gemini-1.5-flash") if config else "gemini-1.5-flash"
    llm = get_llm(model_name=model_name)
    structured_llm = llm.with_structured_output(RedactionOutput)
    
    prompt = f"""
    Analyze the following customer support ticket description and redact any Personally Identifiable Information (PII).
    Specifically, replace credit card numbers, social security numbers, and explicit passwords with '[REDACTED]'.
    If no PII is present, return the original description exactly as it is and set pii_redacted to false.
    
    Description:
    {desc}
    """
    
    try:
        result = await structured_llm.ainvoke(prompt)
        return {
            "description": result.redacted_description,
            "pii_redacted": result.pii_redacted
        }
    except Exception as e:
        # Fallback if LLM fails
        return {"pii_redacted": False}

async def ag_01_intake(state: AgentState):
    """AG-01: Intake. Normalizes the request."""
    # Payload is already validated via FastAPI Pydantic models.
    # Passing through for LangGraph formal steps.
    return {}


class TriageOutput(BaseModel):
    sentiment: str = Field(description="positive, neutral, negative, or angry")
    priority: str = Field(description="P1, P2, P3, or P4")
    category: str = Field(description="Categorization of the ticket")

async def ag_02_triage(state: AgentState, config: RunnableConfig):
    """AG-02: Triage & Sentiment LLM."""
    model_name = config.get("configurable", {}).get("model_name", "gemini-1.5-flash") if config else "gemini-1.5-flash"
    llm = get_llm(model_name=model_name)
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
        result = await structured_llm.ainvoke(prompt)
        sentiment = result.sentiment.lower()
        if sentiment not in [s.value for s in SentimentLabel]:
            sentiment = SentimentLabel.NEUTRAL.value
            
        priority = result.priority.upper()
        if priority not in [p.value for p in Priority]:
            priority = Priority.P4.value
            
        return {
            "sentiment": sentiment,
            "priority": priority,
            "category": result.category,
            "status": TicketStatus.TRIAGED.value
        }
    except Exception as e:
        return {"error": str(e), "status": TicketStatus.TRIAGED.value}


async def ag_06_sla_clocks(state: AgentState):
    """AG-06: SLA Clocks."""
    priority = state.get("priority", Priority.P4.value)
    defaults = {"P1": 15, "P2": 60, "P3": 240, "P4": 480}
    
    mins = defaults.get(priority, 480)
    deadline = datetime.now(timezone.utc) + timedelta(minutes=mins)
    
    return {"sla_deadline": deadline}


async def ag_08_escalation_guard(state: AgentState):
    """AG-08: Escalation Guard. Flags for HIL if needed."""
    sentiment = state.get("sentiment")
    priority = state.get("priority")
    category = state.get("category", "").lower()
    
    escalate = False
    
    # HIL-3/4 rules: Angry, Billing/Legal, or High Priority (P1/P2)
    if sentiment == SentimentLabel.ANGRY.value:
        escalate = True
    elif "billing" in category or "legal" in category:
        escalate = True
    elif priority in [Priority.P1.value, Priority.P2.value]:
        escalate = True
        
    if escalate:
        return {"escalate": True, "status": TicketStatus.PENDING_HIL.value}
        
    return {"escalate": False}
