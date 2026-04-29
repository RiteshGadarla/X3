"""Ticket ORM model."""

import enum
from datetime import datetime, timezone
from sqlalchemy import String, Text, ForeignKey, DateTime, Enum as SAEnum, Boolean, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base


class Priority(str, enum.Enum):
    UNASSIGNED = "UNASSIGNED"
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
    priority: Mapped[Priority] = mapped_column(SAEnum(Priority), default=Priority.UNASSIGNED)
    status: Mapped[TicketStatus] = mapped_column(SAEnum(TicketStatus), default=TicketStatus.NEW)
    sentiment: Mapped[SentimentLabel] = mapped_column(SAEnum(SentimentLabel), default=SentimentLabel.NEUTRAL)

    # PII redaction flag (AG-13)
    pii_redacted: Mapped[bool] = mapped_column(Boolean, default=False)

    # AI disclosure checkbox (UI-09 requirement)
    ai_disclosure_accepted: Mapped[bool] = mapped_column(Boolean, default=False)

    # ── Phase 2: Ticket Splitting (AG-11) ──
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("tickets.id"), nullable=True)
    children: Mapped[list["Ticket"]] = relationship(
        "Ticket", back_populates="parent", foreign_keys="Ticket.parent_id"
    )
    parent: Mapped["Ticket | None"] = relationship(
        "Ticket", back_populates="children", remote_side="Ticket.id", foreign_keys="Ticket.parent_id"
    )

    # ── Phase 2: Deduplication Linking (AG-03) ──
    master_ticket_id: Mapped[int | None] = mapped_column(ForeignKey("tickets.id"), nullable=True)

    # ── Phase 2: Routing (AG-04) ──
    routing_target: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # ── Phase 2: SDLC Gate (AG-09) ──
    sdlc_devops_ok: Mapped[bool] = mapped_column(Boolean, default=False)
    sdlc_qa_ok: Mapped[bool] = mapped_column(Boolean, default=False)

    # ── Phase 2: Loop Detection (AG-14) ──
    loop_count: Mapped[int] = mapped_column(Integer, default=0)

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
