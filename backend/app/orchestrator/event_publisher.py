from __future__ import annotations

from app.models.research import SSEEventType
from app.models.runtime import RuntimeResearchState, RuntimeTimelineNode
from app.models.session import ResearchSession


def friendly_model_name(model_string: str) -> str:
    if ":" in model_string:
        model_string = model_string.split(":", 1)[1]
    if "/" in model_string:
        model_string = model_string.split("/", 1)[1]

    name_map = {
        "deepseek-chat": "DeepSeek",
        "deepseek-reasoner": "DeepSeek R1",
    }
    if model_string in name_map:
        return name_map[model_string]

    name = model_string.replace("-preview", "").replace("-", " ").title()
    for abbr in ("Gpt", "Ai", "Llm"):
        name = name.replace(abbr, abbr.upper())
    return name


async def push_progress(
    session: ResearchSession,
    *,
    phase: str,
    message: str,
    percent: int = 0,
    model: str | None = None,
) -> None:
    payload = {"phase": phase, "message": message, "percent": percent}
    if model:
        payload["model"] = model
    await session.push(SSEEventType.PROGRESS, payload)


async def push_skeleton(
    session: ResearchSession,
    nodes: list[RuntimeTimelineNode],
    *,
    partial: bool = False,
) -> None:
    payload = {"nodes": [node.to_sse_dict() for node in nodes]}
    if partial:
        payload["partial"] = True
    await session.push(SSEEventType.SKELETON, payload)


async def push_node_progress(
    session: ResearchSession,
    *,
    node_id: str,
    model: str,
    step: str,
) -> None:
    await session.push(
        SSEEventType.NODE_PROGRESS,
        {
            "node_id": node_id,
            "model": model,
            "step": step,
        },
    )


async def push_node_detail(session: ResearchSession, node: RuntimeTimelineNode) -> None:
    if node.details is None:
        return
    await session.push(
        SSEEventType.NODE_DETAIL,
        {
            "node_id": node.id,
            "details": node.details.model_dump(),
        },
    )


async def push_synthesis(session: ResearchSession, synthesis_data: dict) -> None:
    await session.push(SSEEventType.SYNTHESIS, synthesis_data)


async def push_complete(
    session: ResearchSession,
    *,
    total_nodes: int,
    detail_completed: int,
) -> None:
    await session.push(
        SSEEventType.COMPLETE,
        {
            "total_nodes": total_nodes,
            "detail_completed": detail_completed,
        },
    )


async def push_research_error(session: ResearchSession, *, message: str) -> None:
    await session.push(
        SSEEventType.RESEARCH_ERROR,
        {
            "error": "research_failed",
            "message": message,
        },
    )


def runtime_nodes_to_dicts(nodes: list[RuntimeTimelineNode]) -> list[dict]:
    return [node.to_db_dict() for node in nodes]


def sorted_runtime_nodes(state: RuntimeResearchState) -> list[RuntimeTimelineNode]:
    return sorted(state.nodes, key=lambda node: node.date)
