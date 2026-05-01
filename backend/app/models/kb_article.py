"""KB Article ORM model — stores AG-10 drafts awaiting HIL-5 publication."""

import enum
from datetime import datetime, timezone
from sqlalchemy import String, Text, ForeignKey, DateTime, Enum as SAEnum, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base


class KBArticleStatus(str, enum.Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    REJECTED = "rejected"


class KBArticle(Base):
    __tablename__ = "kb_articles"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    source_ticket_ref: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)
    status: Mapped[KBArticleStatus] = mapped_column(
        SAEnum(KBArticleStatus), default=KBArticleStatus.DRAFT, index=True
    )
    published_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
