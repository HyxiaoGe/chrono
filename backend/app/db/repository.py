from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import delete, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import ResearchRow, TimelineNodeRow
from app.models.research import ResearchProposal
from app.utils.topic import normalize_topic

_LIKE_ESCAPE = str.maketrans({"%": "\\%", "_": "\\_"})


async def get_research_by_topic(session: AsyncSession, topic: str) -> ResearchRow | None:
    normalized = normalize_topic(topic)
    # Exact match first
    stmt = select(ResearchRow).where(ResearchRow.topic_normalized == normalized)
    result = await session.execute(stmt)
    row = result.scalar_one_or_none()
    if row is not None:
        return row
    # Fuzzy: DB topic contains user input, or user input contains DB topic
    stmt = (
        select(ResearchRow)
        .where(
            or_(
                ResearchRow.topic_normalized.contains(normalized),
                ResearchRow.topic.ilike(f"%{topic.strip().translate(_LIKE_ESCAPE)}%", escape="\\"),
            )
        )
        .order_by(ResearchRow.created_at.desc())
    )
    result = await session.execute(stmt)
    return result.scalars().first()


async def list_topic_candidates(
    session: AsyncSession, limit: int = 50
) -> list[tuple[str, str, uuid.UUID]]:
    stmt = (
        select(ResearchRow.topic, ResearchRow.topic_normalized, ResearchRow.id)
        .where(ResearchRow.total_nodes > 0)
        .order_by(ResearchRow.created_at.desc())
        .limit(limit)
    )
    result = await session.execute(stmt)
    return list(result.all())


async def get_nodes_for_research(
    session: AsyncSession, research_id: uuid.UUID
) -> list[TimelineNodeRow]:
    stmt = (
        select(TimelineNodeRow)
        .where(TimelineNodeRow.research_id == research_id)
        .order_by(TimelineNodeRow.sort_order)
    )
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def list_researches(session: AsyncSession) -> list[ResearchRow]:
    stmt = (
        select(ResearchRow)
        .where(ResearchRow.total_nodes > 0)
        .order_by(ResearchRow.created_at.desc())
    )
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def save_research(
    session: AsyncSession,
    *,
    proposal: ResearchProposal,
    nodes: list[dict],
    synthesis_data: dict | None,
    total_nodes: int,
    source_count: int,
) -> ResearchRow:
    existing = await get_research_by_topic(session, proposal.topic)

    if existing:
        existing.topic_normalized = normalize_topic(proposal.topic)
        existing.topic_type = proposal.topic_type.value
        existing.language = proposal.language
        existing.complexity_level = proposal.complexity.level.value
        existing.proposal = proposal.model_dump()
        existing.synthesis = synthesis_data
        existing.total_nodes = total_nodes
        existing.source_count = source_count
        existing.updated_at = datetime.now()
        research = existing
        # Delete old nodes
        await session.execute(
            delete(TimelineNodeRow).where(TimelineNodeRow.research_id == research.id)
        )
        await session.flush()
    else:
        research = ResearchRow(
            topic=proposal.topic,
            topic_normalized=normalize_topic(proposal.topic),
            topic_type=proposal.topic_type.value,
            language=proposal.language,
            complexity_level=proposal.complexity.level.value,
            proposal=proposal.model_dump(),
            synthesis=synthesis_data,
            total_nodes=total_nodes,
            source_count=source_count,
        )
        session.add(research)
        await session.flush()

    for i, node in enumerate(nodes):
        row = TimelineNodeRow(
            research_id=research.id,
            node_id=node["id"],
            date=node["date"],
            title=node["title"],
            subtitle=node.get("subtitle", ""),
            significance=node["significance"],
            description=node["description"],
            details=node.get("details"),
            is_gap_node=node.get("is_gap_node", False),
            phase_name=node.get("phase_name"),
            sort_order=i,
        )
        session.add(row)

    await session.commit()
    return research
