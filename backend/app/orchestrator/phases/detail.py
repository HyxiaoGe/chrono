from __future__ import annotations

import asyncio
import logging

from pydantic_ai.models import Model

from app.agents.detail import run_detail_agent
from app.config import settings
from app.models.runtime import RuntimeResearchState, RuntimeTimelineNode
from app.models.session import ResearchSession
from app.orchestrator.event_publisher import (
    friendly_model_name,
    push_node_detail,
    push_node_progress,
    push_progress,
)
from app.orchestrator.messages import get_progress_message
from app.orchestrator.verification import RECENT_CUTOFF
from app.services.llm import resolve_model
from app.services.tavily import TavilyService

logger = logging.getLogger(__name__)


def build_detail_pool() -> list[Model]:
    if not settings.detail_model_pool:
        return []

    pool: list[Model] = []
    for model_string in settings.detail_model_pool.split(","):
        model_string = model_string.strip()
        if not model_string:
            continue
        try:
            pool.append(resolve_model(model_string))
        except ValueError:
            logger.warning("Skipping invalid pool model: %s", model_string)
    return pool


DETAIL_POOL = build_detail_pool()


async def run_detail_phase(
    state: RuntimeResearchState,
    session: ResearchSession,
    tavily: TavilyService,
    *,
    model_name: str,
) -> None:
    await push_progress(
        session,
        phase="detail",
        message=get_progress_message("detail", state.proposal.language),
        model=friendly_model_name(model_name),
    )
    await enrich_nodes(state, session, tavily, state.nodes)


async def enrich_nodes(
    state: RuntimeResearchState,
    session: ResearchSession,
    tavily: TavilyService,
    nodes: list[RuntimeTimelineNode],
) -> None:
    sem = asyncio.Semaphore(settings.detail_concurrency)
    pool_counter = 0
    node_index = {node.id: idx for idx, node in enumerate(state.nodes)}

    async def enrich_node(node: RuntimeTimelineNode) -> None:
        nonlocal pool_counter
        async with sem:
            model_override = None
            model_name_str = settings.detail_model
            if DETAIL_POOL:
                idx = pool_counter % len(DETAIL_POOL)
                model_override = DETAIL_POOL[idx]
                pool_parts = settings.detail_model_pool.split(",")
                if idx < len(pool_parts):
                    model_name_str = pool_parts[idx].strip()
                pool_counter += 1

            friendly = friendly_model_name(model_name_str)
            await push_node_progress(
                session,
                node_id=node.id,
                model=friendly,
                step="searching",
            )

            try:
                detail, search_context = await run_detail_agent(
                    node=node.to_sse_dict(),
                    topic=state.proposal.topic,
                    language=state.proposal.language,
                    tavily=tavily,
                    model_override=model_override,
                )
            except Exception:
                logger.warning("Detail agent failed for node %s", node.id)
                return

        updated = node.with_details(detail)
        state.detail_completed += 1
        if updated.date >= RECENT_CUTOFF:
            state.detail_contexts[updated.id] = search_context
        state.nodes[node_index[updated.id]] = updated
        await push_node_detail(session, updated)

    async with asyncio.TaskGroup() as tg:
        for node in nodes:
            tg.create_task(enrich_node(node))
