import os
import uuid

import httpx
import pytest

os.environ["ORCHESTRATOR_MODEL"] = "qwen/qwen-max"
os.environ["MILESTONE_MODEL"] = "deepseek/deepseek-chat"
os.environ["DETAIL_MODEL"] = "deepseek/deepseek-chat"
os.environ["DEDUP_MODEL"] = "deepseek/deepseek-chat"
os.environ["HALLUCINATION_MODEL"] = "deepseek/deepseek-chat"
os.environ["SIMILAR_TOPIC_MODEL"] = "deepseek/deepseek-chat"
os.environ["GAP_ANALYSIS_MODEL"] = "qwen/qwen-max"
os.environ["SYNTHESIZER_MODEL"] = "qwen/qwen-max"

from app import main


async def _post(path: str, *, json: dict | None = None) -> httpx.Response:
    transport = httpx.ASGITransport(app=main.app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        return await client.post(path, json=json)


@pytest.mark.asyncio
async def test_create_research_returns_maintenance_without_running_research(monkeypatch) -> None:
    async def no_cached_proposal(_normalized_topic):
        return None

    async def fail_create_proposal(_request):
        raise AssertionError("maintenance mode must not call the research orchestrator")

    monkeypatch.setattr(main, "async_session_factory", None)
    monkeypatch.setattr(main, "get_cached_proposal", no_cached_proposal)
    monkeypatch.setattr(main.orchestrator, "create_proposal", fail_create_proposal)

    response = await _post("/api/research", json={"topic": "OpenAI", "language": "auto"})

    assert response.status_code == 503
    assert response.json() == {
        "detail": {
            "error": "service_maintenance",
            "message": "Chrono research is temporarily paused for maintenance.",
        }
    }


@pytest.mark.asyncio
async def test_create_replay_session_returns_maintenance_without_loading_research(
    monkeypatch,
) -> None:
    async def fail_create_replay_session_for_research(_research_id, _session_manager):
        raise AssertionError("maintenance mode must not create replay sessions")

    monkeypatch.setattr(
        main,
        "create_replay_session_for_research",
        fail_create_replay_session_for_research,
    )
    research_id = uuid.UUID("00000000-0000-0000-0000-000000000001")

    response = await _post(f"/api/researches/{research_id}/replay")

    assert response.status_code == 503
    assert response.json() == {
        "detail": {
            "error": "service_maintenance",
            "message": "Chrono research is temporarily paused for maintenance.",
        }
    }
