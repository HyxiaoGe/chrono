from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class ResearchRow(Base):
    __tablename__ = "researches"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    topic: Mapped[str] = mapped_column(Text, unique=True, index=True)
    topic_type: Mapped[str] = mapped_column(String(32))
    language: Mapped[str] = mapped_column(String(16))
    complexity_level: Mapped[str] = mapped_column(String(16))
    proposal: Mapped[dict] = mapped_column(JSONB)
    synthesis: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    total_nodes: Mapped[int] = mapped_column(Integer, default=0)
    source_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.now, onupdate=datetime.now
    )

    nodes: Mapped[list[TimelineNodeRow]] = relationship(
        back_populates="research", cascade="all, delete-orphan"
    )


class TimelineNodeRow(Base):
    __tablename__ = "timeline_nodes"
    __table_args__ = (UniqueConstraint("research_id", "node_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    research_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("researches.id", ondelete="CASCADE")
    )
    node_id: Mapped[str] = mapped_column(String(16))
    date: Mapped[str] = mapped_column(String(32))
    title: Mapped[str] = mapped_column(Text)
    subtitle: Mapped[str] = mapped_column(Text, default="")
    significance: Mapped[str] = mapped_column(String(16))
    description: Mapped[str] = mapped_column(Text)
    details: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    is_gap_node: Mapped[bool] = mapped_column(Boolean, default=False)
    phase_name: Mapped[str | None] = mapped_column(String(64), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.now)

    research: Mapped[ResearchRow] = relationship(back_populates="nodes")
