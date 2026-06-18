import uuid
from types import SimpleNamespace

import pytest

from app.db import replay
from app.models.research import ResearchProposal
from app.models.session import ResearchSession, SessionStatus


def make_proposal() -> ResearchProposal:
    return ResearchProposal.model_validate(
        {
            "topic": "iPhone",
            "topic_type": "product",
            "language": "en",
            "complexity": {
                "level": "light",
                "time_span": "2007-2026",
                "parallel_threads": 1,
                "estimated_total_nodes": 1,
                "reasoning": "single product line",
            },
            "research_threads": [
                {
                    "name": "Product launches",
                    "description": "Major launches",
                    "priority": 5,
                    "estimated_nodes": 1,
                }
            ],
            "estimated_duration": {"min_seconds": 90, "max_seconds": 180},
            "credits_cost": 1,
            "user_facing": {
                "title": "History of iPhone",
                "summary": "Timeline of iPhone development.",
                "duration_text": "about 2 minutes",
                "credits_text": "1 credit",
                "thread_names": ["Product launches"],
            },
        }
    )


@pytest.mark.asyncio
async def test_replay_research_pushes_cached_events_in_frontend_order(monkeypatch) -> None:
    research_id = uuid.uuid4()
    research = SimpleNamespace(
        total_nodes=1,
        synthesis={
            "summary": "iPhone changed smartphones.",
            "key_insight": "The App Store created the durable platform shift.",
            "timeline_span": "2007 - 2008",
            "source_count": 2,
            "verification_notes": [],
            "connections": [],
            "date_corrections": [],
        },
    )
    node_rows = [
        SimpleNamespace(
            node_id="ms_001",
            date="2007-01-09",
            title="iPhone announced",
            subtitle="Apple",
            significance="revolutionary",
            description="Apple announced the first iPhone.",
            details={
                "key_features": ["Multi-touch smartphone"],
                "impact": "It reshaped the smartphone market.",
                "key_people": ["Steve Jobs — Apple CEO"],
                "context": "Apple combined phone, iPod, and internet communicator.",
                "sources": ["https://example.com/iphone"],
            },
            phase_name="Launch",
            is_gap_node=False,
        )
    ]
    status_updates: list[tuple[str, str, uuid.UUID | None]] = []

    async def fake_load_research_snapshot(requested_research_id):
        assert requested_research_id == research_id
        return research, node_rows

    async def fake_update_session_status(session_id, status, *, cached_research_id=None):
        status_updates.append((session_id, status, cached_research_id))

    monkeypatch.setattr(replay, "_load_research_snapshot", fake_load_research_snapshot)
    monkeypatch.setattr(replay, "update_session_status", fake_update_session_status)

    session = ResearchSession(
        "session-1",
        make_proposal(),
        cached_research_id=research_id,
    )

    await replay.replay_research(session, research_id)

    assert [event_type.value for event_type, _payload in session._event_history] == [
        "skeleton",
        "node_detail",
        "synthesis",
        "complete",
    ]
    assert session.status == SessionStatus.COMPLETED
    assert session._event_history[0][1]["nodes"][0]["id"] == "ms_001"
    assert session._event_history[1][1]["node_id"] == "ms_001"
    assert session._event_history[2][1]["summary"] == "iPhone changed smartphones."
    assert session._event_history[3][1] == {"total_nodes": 1, "detail_completed": 1}
    assert status_updates == [("session-1", "completed", research_id)]
