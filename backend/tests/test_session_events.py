import json

import pytest

from app.models.research import ResearchProposal, SSEEventType
from app.models.session import ResearchSession, SessionStatus


class NeverDisconnectedRequest:
    async def is_disconnected(self) -> bool:
        return False


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
                "estimated_total_nodes": 3,
                "reasoning": "single product line",
            },
            "research_threads": [
                {
                    "name": "Product launches",
                    "description": "Major launches",
                    "priority": 5,
                    "estimated_nodes": 3,
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


def event_payload(event) -> dict:
    return json.loads(event.data)


@pytest.mark.asyncio
async def test_push_records_history_and_live_generator_yields_event() -> None:
    session = ResearchSession("session-1", make_proposal())
    await session.push(SSEEventType.PROGRESS, {"phase": "skeleton", "percent": 10})
    await session.close()

    assert session.has_events is True

    generator = session.event_generator(NeverDisconnectedRequest())
    event = await generator.__anext__()

    assert event.event == "progress"
    assert event_payload(event) == {"phase": "skeleton", "percent": 10}


@pytest.mark.asyncio
async def test_replay_and_stream_replays_history_after_completion() -> None:
    session = ResearchSession("session-1", make_proposal())
    await session.push(SSEEventType.SKELETON, {"nodes": [{"id": "ms_001"}]})
    await session.push(SSEEventType.COMPLETE, {"total_nodes": 1, "detail_completed": 1})
    session.status = SessionStatus.COMPLETED

    events = [event async for event in session.replay_and_stream(NeverDisconnectedRequest())]

    assert [event.event for event in events] == ["skeleton", "complete"]
    assert event_payload(events[0]) == {"nodes": [{"id": "ms_001"}]}
    assert event_payload(events[1]) == {"total_nodes": 1, "detail_completed": 1}
