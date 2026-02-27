from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import ResearchRow, TimelineNodeRow
from app.models.research import ResearchProposal


async def get_research_by_topic(session: AsyncSession, topic: str) -> ResearchRow | None:
    stmt = select(ResearchRow).where(ResearchRow.topic == topic)
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


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
            sort_order=i,
        )
        session.add(row)

    await session.commit()
    return research
