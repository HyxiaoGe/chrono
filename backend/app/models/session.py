import asyncio
import json
from enum import StrEnum
from typing import Any

from fastapi import Request
from sse_starlette import ServerSentEvent

from app.models.research import ResearchProposal, SSEEventType


class SessionStatus(StrEnum):
    PROPOSAL_READY = "proposal_ready"
    EXECUTING = "executing"
    COMPLETED = "completed"
    FAILED = "failed"


class ResearchSession:
    def __init__(self, session_id: str, proposal: ResearchProposal) -> None:
        self.session_id = session_id
        self.proposal = proposal
        self.status = SessionStatus.PROPOSAL_READY
        self.queue: asyncio.Queue[tuple[SSEEventType, dict[str, Any]] | None] = asyncio.Queue()
        self.task: asyncio.Task[None] | None = None

    async def push(self, event_type: SSEEventType, data: dict[str, Any]) -> None:
        if self.status not in (SessionStatus.COMPLETED, SessionStatus.FAILED):
            await self.queue.put((event_type, data))

    async def close(self) -> None:
        await self.queue.put(None)

    async def event_generator(self, request: Request):
        try:
            while True:
                if await request.is_disconnected():
                    break
                try:
                    item = await asyncio.wait_for(self.queue.get(), timeout=5.0)
                except TimeoutError:
                    continue
                if item is None:
                    break
                event_type, data = item
                yield ServerSentEvent(
                    data=json.dumps(data, ensure_ascii=False),
                    event=event_type.value,
                )
        except asyncio.CancelledError:
            raise


class SessionManager:
    def __init__(self) -> None:
        self._sessions: dict[str, ResearchSession] = {}

    def create(self, session_id: str, proposal: ResearchProposal) -> ResearchSession:
        session = ResearchSession(session_id, proposal)
        self._sessions[session_id] = session
        return session

    def get(self, session_id: str) -> ResearchSession | None:
        return self._sessions.get(session_id)
