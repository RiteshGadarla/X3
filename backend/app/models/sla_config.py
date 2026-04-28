"""SLA Configuration ORM model (HIL-1 controlled)."""

from datetime import datetime, timezone
from sqlalchemy import String, Integer, Boolean, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base


class SLAConfig(Base):
    __tablename__ = "sla_configs"

    id: Mapped[int] = mapped_column(primary_key=True)
    priority: Mapped[str] = mapped_column(String(4), unique=True, nullable=False)  # P1-P4
    response_time_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    resolution_time_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # HIL-1: Admin must approve any change before AI uses it
    approved_by_admin: Mapped[bool] = mapped_column(Boolean, default=False)

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
