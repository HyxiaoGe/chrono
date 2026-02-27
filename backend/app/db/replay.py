from __future__ import annotations

import uuid

from sqlalchemy import select

from app.db.database import async_session_factory
from app.db.models import ResearchRow
from app.db.repository import get_nodes_for_research
from app.models.research import SSEEventType
from app.models.session import ResearchSession, SessionStatus


async def replay_research(session: ResearchSession, research_id: uuid.UUID) -> None:
    assert async_session_factory is not None

    async with async_session_factory() as db:
        result = await db.execute(select(ResearchRow).where(ResearchRow.id == research_id))
        research = result.scalar_one()
        node_rows = await get_nodes_for_research(db, research_id)

    # Build node dicts (same shape as pipeline output)
    nodes_dicts = []
    for row in node_rows:
        node_dict = {
            "id": row.node_id,
            "date": row.date,
            "title": row.title,
            "subtitle": row.subtitle,
            "significance": row.significance,
            "description": row.description,
            "sources": row.details.get("sources", []) if row.details else [],
            "status": "skeleton",
            "details": row.details,
        }
        nodes_dicts.append(node_dict)

    # 1. SKELETON (complete final node list)
    await session.push(SSEEventType.SKELETON, {"nodes": nodes_dicts})

    # 2. NODE_DETAIL × N
    for row in node_rows:
        if row.details:
            await session.push(
                SSEEventType.NODE_DETAIL,
                {
                    "node_id": row.node_id,
                    "details": row.details,
                },
            )

    # 3. SYNTHESIS
    if research.synthesis:
        await session.push(SSEEventType.SYNTHESIS, research.synthesis)

    # 4. COMPLETE
    await session.push(
        SSEEventType.COMPLETE,
        {
            "total_nodes": research.total_nodes,
            "detail_completed": research.total_nodes,
        },
    )
    session.status = SessionStatus.COMPLETED
    await session.close()
