from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import delete, literal, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import ResearchRow, TimelineNodeRow
from app.models.research import ResearchProposal
from app.utils.topic import normalize_topic

_LIKE_ESCAPE = str.maketrans({"%": "\\%", "_": "\\_"})


def _topic_fuzzy_conditions(topic: str, normalized: str):
    return or_(
        ResearchRow.topic_normalized.contains(normalized),
        ResearchRow.topic.ilike(f"%{topic.strip().translate(_LIKE_ESCAPE)}%", escape="\\"),
    )


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
        .where(_topic_fuzzy_conditions(topic, normalized))
        .order_by(ResearchRow.created_at.desc())
    )
    result = await session.execute(stmt)
    return result.scalars().first()


async def get_research_id_by_topic(session: AsyncSession, topic: str) -> uuid.UUID | None:
    normalized = normalize_topic(topic)

    stmt = select(ResearchRow.id).where(ResearchRow.topic_normalized == normalized)
    result = await session.execute(stmt)
    research_id = result.scalar_one_or_none()
    if research_id is not None:
        return research_id

    stmt = (
        select(ResearchRow.id)
        .where(_topic_fuzzy_conditions(topic, normalized))
        .order_by(ResearchRow.created_at.desc())
    )
    result = await session.execute(stmt)
    return result.scalars().first()


async def get_cached_research_proposal_by_topic(session: AsyncSession, topic: str):
    normalized = normalize_topic(topic)
    selected_columns = (ResearchRow.id, ResearchRow.proposal)

    stmt = select(*selected_columns).where(ResearchRow.topic_normalized == normalized)
    result = await session.execute(stmt)
    row = result.first()
    if row is not None:
        return row

    stmt = (
        select(*selected_columns)
        .where(_topic_fuzzy_conditions(topic, normalized))
        .order_by(ResearchRow.created_at.desc())
    )
    result = await session.execute(stmt)
    return result.first()


async def get_cached_research_proposal_by_id(session: AsyncSession, research_id: uuid.UUID):
    stmt = select(ResearchRow.id, ResearchRow.proposal).where(ResearchRow.id == research_id)
    result = await session.execute(stmt)
    return result.first()


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


async def get_research_replay_metadata(session: AsyncSession, research_id: uuid.UUID):
    stmt = select(ResearchRow.synthesis, ResearchRow.total_nodes).where(
        ResearchRow.id == research_id
    )
    result = await session.execute(stmt)
    return result.first()


async def get_nodes_for_research_replay(session: AsyncSession, research_id: uuid.UUID):
    stmt = (
        select(
            TimelineNodeRow.node_id,
            TimelineNodeRow.date,
            TimelineNodeRow.title,
            TimelineNodeRow.subtitle,
            TimelineNodeRow.significance,
            TimelineNodeRow.description,
            TimelineNodeRow.details,
            TimelineNodeRow.is_gap_node,
            TimelineNodeRow.phase_name,
        )
        .where(TimelineNodeRow.research_id == research_id)
        .order_by(TimelineNodeRow.sort_order)
    )
    result = await session.execute(stmt)
    return list(result.all())


async def list_researches(
    session: AsyncSession, *, locale: str | None = None, limit: int | None = None
):
    timeline_span = ResearchRow.synthesis["timeline_span"].as_string().label("timeline_span")
    key_insight = ResearchRow.synthesis["key_insight"].as_string().label("key_insight")
    stmt = (
        select(
            ResearchRow.id,
            ResearchRow.topic,
            ResearchRow.topic_type,
            ResearchRow.language,
            ResearchRow.complexity_level,
            ResearchRow.total_nodes,
            ResearchRow.source_count,
            ResearchRow.created_at,
            timeline_span,
            key_insight,
        )
        .where(ResearchRow.total_nodes > 0)
        .order_by(ResearchRow.created_at.desc())
    )
    if locale:
        stmt = stmt.where(ResearchRow.language.like(f"{locale}%"))
    if limit is not None:
        stmt = stmt.limit(limit)
    result = await session.execute(stmt)
    return list(result.all())


async def list_cached_topic_normalized(
    session: AsyncSession, *, candidates: set[str] | None = None
) -> list[str]:
    stmt = (
        select(ResearchRow.topic_normalized)
        .where(ResearchRow.total_nodes > 0)
        .order_by(ResearchRow.created_at.desc())
    )
    if candidates is not None:
        if not candidates:
            return []
        conditions = []
        for candidate in sorted(candidates):
            conditions.extend(
                (
                    ResearchRow.topic_normalized.contains(candidate),
                    literal(candidate).contains(ResearchRow.topic_normalized),
                )
            )
        stmt = stmt.where(or_(*conditions))
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
) -> uuid.UUID:
    existing_id = await get_research_id_by_topic(session, proposal.topic)

    if existing_id:
        await session.execute(
            update(ResearchRow)
            .where(ResearchRow.id == existing_id)
            .values(
                topic_normalized=normalize_topic(proposal.topic),
                topic_type=proposal.topic_type.value,
                language=proposal.language,
                complexity_level=proposal.complexity.level.value,
                proposal=proposal.model_dump(),
                synthesis=synthesis_data,
                total_nodes=total_nodes,
                source_count=source_count,
                updated_at=datetime.now(),
            )
        )
        # Delete old nodes
        await session.execute(
            delete(TimelineNodeRow).where(TimelineNodeRow.research_id == existing_id)
        )
        await session.flush()
        research_id = existing_id
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
        research_id = research.id

    for i, node in enumerate(nodes):
        row = TimelineNodeRow(
            research_id=research_id,
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
    return research_id
