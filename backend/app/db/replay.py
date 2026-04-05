from __future__ import annotations

import uuid

from sqlalchemy import select

from app.db.database import async_session_factory
from app.db.models import ResearchRow
from app.db.redis import update_session_status
from app.db.repository import get_nodes_for_research
from app.models.runtime import RuntimeTimelineNode
from app.models.session import ResearchSession, SessionStatus
from app.orchestrator.event_publisher import (
    push_complete,
    push_node_detail,
    push_skeleton,
    push_synthesis,
)


async def replay_research(session: ResearchSession, research_id: uuid.UUID) -> None:
    assert async_session_factory is not None

    async with async_session_factory() as db:
        result = await db.execute(select(ResearchRow).where(ResearchRow.id == research_id))
        research = result.scalar_one()
        node_rows = await get_nodes_for_research(db, research_id)

    nodes: list[RuntimeTimelineNode] = []
    for row in node_rows:
        payload = {
            "id": row.node_id,
            "date": row.date,
            "title": row.title,
            "subtitle": row.subtitle,
            "significance": row.significance,
            "description": row.description,
            "sources": row.details.get("sources", []) if row.details else [],
            "status": "complete" if row.details else "skeleton",
            "details": row.details,
            "phase_name": row.phase_name,
            "is_gap_node": row.is_gap_node,
        }
        nodes.append(RuntimeTimelineNode.from_dict(payload))

    await push_skeleton(session, nodes)

    for node in nodes:
        if node.details is not None:
            await push_node_detail(session, node)

    if research.synthesis:
        await push_synthesis(session, research.synthesis)

    await push_complete(
        session,
        total_nodes=research.total_nodes,
        detail_completed=research.total_nodes,
    )
    session.status = SessionStatus.COMPLETED
    await update_session_status(
        session.session_id,
        SessionStatus.COMPLETED.value,
        cached_research_id=session.cached_research_id,
    )
    await session.close()
