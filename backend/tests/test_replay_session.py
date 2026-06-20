import uuid
from types import SimpleNamespace

import pytest

from app.models.session import SessionManager, SessionStatus
from app.session import replay_session
from app.session.replay_session import create_replay_session_for_research
from tests.test_repository_queries import make_proposal


class FakeAsyncSessionFactory:
    def __init__(self) -> None:
        self.enter_count = 0
        self.session = object()

    def __call__(self):
        return self

    async def __aenter__(self):
        self.enter_count += 1
        return self.session

    async def __aexit__(self, exc_type, exc, tb):
        return False


@pytest.mark.asyncio
async def test_create_replay_session_for_research_creates_executing_cached_session(
    monkeypatch,
) -> None:
    research_id = uuid.UUID("00000000-0000-0000-0000-000000000001")
    session_id = uuid.UUID("00000000-0000-0000-0000-000000000099")
    proposal = make_proposal()
    factory = FakeAsyncSessionFactory()
    lookup_calls: list[tuple[object, uuid.UUID]] = []
    stored_sessions: list[tuple[str, dict, str, str | None]] = []

    async def fake_get_cached_research_proposal_by_id(db_session, requested_id):
        lookup_calls.append((db_session, requested_id))
        return SimpleNamespace(id=research_id, proposal=proposal.model_dump())

    async def fake_store_session(
        stored_session_id,
        stored_proposal,
        status,
        *,
        cached_research_id=None,
    ):
        stored_sessions.append((stored_session_id, stored_proposal, status, cached_research_id))

    monkeypatch.setattr(replay_session, "async_session_factory", factory)
    monkeypatch.setattr(
        replay_session,
        "get_cached_research_proposal_by_id",
        fake_get_cached_research_proposal_by_id,
    )
    monkeypatch.setattr(replay_session, "store_session", fake_store_session)
    monkeypatch.setattr(replay_session.uuid, "uuid4", lambda: session_id)

    manager = SessionManager()

    response = await create_replay_session_for_research(research_id, manager)

    assert response is not None
    assert response.session_id == str(session_id)
    assert response.proposal == proposal
    assert response.cached is True
    assert lookup_calls == [(factory.session, research_id)]
    assert factory.enter_count == 1
    runtime_session = manager.get(str(session_id))
    assert runtime_session is not None
    assert runtime_session.status == SessionStatus.EXECUTING
    assert runtime_session.cached_research_id == research_id
    assert stored_sessions == [
        (
            str(session_id),
            proposal.model_dump(),
            SessionStatus.EXECUTING.value,
            str(research_id),
        )
    ]


@pytest.mark.asyncio
async def test_create_replay_session_for_missing_research_returns_none(monkeypatch) -> None:
    research_id = uuid.UUID("00000000-0000-0000-0000-000000000001")
    factory = FakeAsyncSessionFactory()
    store_calls: list[object] = []

    async def fake_get_cached_research_proposal_by_id(db_session, requested_id):
        return None

    async def fake_store_session(*args, **kwargs):
        store_calls.append((args, kwargs))

    monkeypatch.setattr(replay_session, "async_session_factory", factory)
    monkeypatch.setattr(
        replay_session,
        "get_cached_research_proposal_by_id",
        fake_get_cached_research_proposal_by_id,
    )
    monkeypatch.setattr(replay_session, "store_session", fake_store_session)

    manager = SessionManager()

    response = await create_replay_session_for_research(research_id, manager)

    assert response is None
    assert store_calls == []
