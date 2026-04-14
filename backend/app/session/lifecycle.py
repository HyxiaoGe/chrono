from __future__ import annotations

import asyncio
import logging
import uuid
from collections.abc import Awaitable, Callable

from fastapi import HTTPException, Request
from sse_starlette import EventSourceResponse

from app.db.database import async_session_factory
from app.db.redis import get_session_data, update_session_status
from app.db.replay import replay_research
from app.db.repository import get_research_by_topic
from app.models.research import ResearchProposal
from app.models.session import ResearchSession, SessionManager, SessionStatus

logger = logging.getLogger(__name__)


class SessionLifecycleService:
    def __init__(self, session_manager: SessionManager) -> None:
        self.session_manager = session_manager

    async def get_or_restore_session(self, session_id: str) -> ResearchSession | None:
        session = self.session_manager.get(session_id)
        if session is not None:
            return session

        redis_data = await get_session_data(session_id)
        if redis_data is None:
            return None

        try:
            proposal = ResearchProposal.model_validate(redis_data["proposal"])
            status = SessionStatus(redis_data.get("status", SessionStatus.PROPOSAL_READY))
            cached_research_id = self._parse_cached_research_id(
                redis_data.get("cached_research_id")
            )
            cached_research_id, status = await self._reconcile_cached_research(
                proposal.topic,
                cached_research_id,
                status,
            )
            session = self.session_manager.create(
                session_id,
                proposal,
                status=status,
                cached_research_id=cached_research_id,
            )
            logger.info(
                "Reconstructed session %s from Redis with status %s",
                session_id,
                status.value,
            )
            return session
        except Exception:
            logger.warning("Failed to reconstruct session from Redis", exc_info=True)
            return None

    async def get_status_payload(self, session_id: str) -> dict | None:
        session = await self.get_or_restore_session(session_id)
        if session is None:
            return None
        return {
            "status": session.status.value,
            "proposal": session.proposal.model_dump(),
        }

    async def create_stream_response(
        self,
        session: ResearchSession,
        request: Request,
        *,
        execute_research: Callable[[ResearchSession], Awaitable[None]],
    ) -> EventSourceResponse:
        if session.status == SessionStatus.FAILED:
            raise HTTPException(status_code=410, detail="Session failed")

        if session.status == SessionStatus.PROPOSAL_READY:
            await self._start_session(session, execute_research)
            generator = session.event_generator(request)
        elif (
            session.task is None
            and session.cached_research_id is not None
            and not session.has_events
        ):
            session.status = SessionStatus.EXECUTING
            session.task = asyncio.create_task(replay_research(session, session.cached_research_id))
            generator = session.event_generator(request)
        else:
            generator = session.replay_and_stream(request)

        return EventSourceResponse(
            generator,
            ping=15,
            send_timeout=30,
            headers={"X-Accel-Buffering": "no"},
        )

    async def _start_session(
        self,
        session: ResearchSession,
        execute_research: Callable[[ResearchSession], Awaitable[None]],
    ) -> None:
        if session.task is not None:
            return

        session.status = SessionStatus.EXECUTING
        await update_session_status(
            session.session_id,
            SessionStatus.EXECUTING.value,
            cached_research_id=session.cached_research_id,
        )

        if session.cached_research_id is not None:
            session.task = asyncio.create_task(replay_research(session, session.cached_research_id))
            return

        session.task = asyncio.create_task(execute_research(session))

    async def _reconcile_cached_research(
        self,
        topic: str,
        cached_research_id: uuid.UUID | None,
        status: SessionStatus,
    ) -> tuple[uuid.UUID | None, SessionStatus]:
        research_id = cached_research_id
        if research_id is None and async_session_factory is not None:
            try:
                async with async_session_factory() as db:
                    cached = await get_research_by_topic(db, topic)
                if cached is not None:
                    research_id = cached.id
            except Exception:
                logger.warning("Failed to reconcile cached research by topic", exc_info=True)

        if status in (SessionStatus.EXECUTING, SessionStatus.COMPLETED) and research_id is None:
            return None, SessionStatus.PROPOSAL_READY
        return research_id, status

    @staticmethod
    def _parse_cached_research_id(raw: str | None) -> uuid.UUID | None:
        if not raw:
            return None
        try:
            return uuid.UUID(raw)
        except ValueError:
            return None
