from __future__ import annotations

import uuid

from app.db.database import async_session_factory
from app.db.redis import store_session
from app.db.repository import get_cached_research_proposal_by_id
from app.models.research import ResearchProposal, ResearchProposalResponse
from app.models.session import SessionManager, SessionStatus


async def create_replay_session_for_research(
    research_id: uuid.UUID,
    session_manager: SessionManager,
) -> ResearchProposalResponse | None:
    if async_session_factory is None:
        return None

    async with async_session_factory() as db:
        row = await get_cached_research_proposal_by_id(db, research_id)
    if row is None:
        return None

    proposal = ResearchProposal.model_validate(row.proposal)
    session_id = str(uuid.uuid4())
    session_manager.create(
        session_id,
        proposal,
        status=SessionStatus.EXECUTING,
        cached_research_id=row.id,
    )
    await store_session(
        session_id,
        proposal.model_dump(),
        SessionStatus.EXECUTING.value,
        cached_research_id=str(row.id),
    )
    return ResearchProposalResponse(
        session_id=session_id,
        proposal=proposal,
        cached=True,
    )
