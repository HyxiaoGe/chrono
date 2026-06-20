import uuid

import pytest

from app.models.session import SessionManager, SessionStatus
from app.session import lifecycle
from app.session.lifecycle import SessionLifecycleService


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
async def test_reconcile_cached_research_uses_id_only_lookup(monkeypatch) -> None:
    research_id = uuid.UUID("00000000-0000-0000-0000-000000000001")
    factory = FakeAsyncSessionFactory()
    calls: list[tuple[object, str]] = []

    async def fake_get_research_id_by_topic(session, topic: str):
        calls.append((session, topic))
        return research_id

    monkeypatch.setattr(lifecycle, "async_session_factory", factory)
    monkeypatch.setattr(
        lifecycle,
        "get_research_id_by_topic",
        fake_get_research_id_by_topic,
    )

    service = SessionLifecycleService(SessionManager())

    resolved_id, status = await service._reconcile_cached_research(
        "iPhone",
        None,
        SessionStatus.EXECUTING,
    )

    assert resolved_id == research_id
    assert status == SessionStatus.EXECUTING
    assert factory.enter_count == 1
    assert calls == [(factory.session, "iPhone")]
