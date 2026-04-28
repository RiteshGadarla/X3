"""Ticket ORM model."""

import enum
from datetime import datetime, timezone
from sqlalchemy import String, Text, ForeignKey, DateTime, Enum as SAEnum, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base


class Priority(str, enum.Enum):
    P1 = "P1"  # 15 mins SLA
    P2 = "P2"  # 1 hour SLA
    P3 = "P3"  # 4 hours SLA
    P4 = "P4"  # 1 business day SLA


class TicketStatus(str, enum.Enum):
    NEW = "new"
    TRIAGED = "triaged"
    IN_PROGRESS = "in_progress"
    ESCALATED = "escalated"
    PENDING_HIL = "pending_hil"
    RESOLVED = "resolved"
    CLOSED = "closed"


class SentimentLabel(str, enum.Enum):
    POSITIVE = "positive"
    NEUTRAL = "neutral"
    NEGATIVE = "negative"
    ANGRY = "angry"


class Ticket(Base):
    __tablename__ = "tickets"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    ticket_ref: Mapped[str] = mapped_column(String(32), unique=True, index=True, nullable=False)
    customer_name: Mapped[str] = mapped_column(String(128), nullable=False)
    customer_email: Mapped[str] = mapped_column(String(255), nullable=False)
    subject: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String(64), default="General")
    priority: Mapped[Priority] = mapped_column(SAEnum(Priority), default=Priority.P4)
    status: Mapped[TicketStatus] = mapped_column(SAEnum(TicketStatus), default=TicketStatus.NEW)
    sentiment: Mapped[SentimentLabel] = mapped_column(SAEnum(SentimentLabel), default=SentimentLabel.NEUTRAL)

    # PII redaction flag (AG-13)
    pii_redacted: Mapped[bool] = mapped_column(Boolean, default=False)

    # AI disclosure checkbox (UI-09 requirement)
    ai_disclosure_accepted: Mapped[bool] = mapped_column(Boolean, default=False)

    # Assignment
    assigned_to_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    assigned_to: Mapped["User"] = relationship("User", back_populates="tickets")

    # SLA tracking
    sla_deadline: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
