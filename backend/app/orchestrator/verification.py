from __future__ import annotations

import asyncio
import logging
import random
from datetime import date

from pydantic_ai import Agent

from app.config import settings
from app.models.research import HallucinationCheckResult
from app.models.runtime import RuntimeTimelineNode
from app.services.llm import resolve_model
from app.services.tavily import TavilyService

logger = logging.getLogger(__name__)

RECENT_CUTOFF = str(date.today().year - 1)
SPOT_CHECK_MAX = 5

_hallucination_agent = Agent(
    resolve_model(settings.hallucination_model),
    output_type=HallucinationCheckResult,
    instructions=(
        "You are a fact-checking specialist. You will receive a list of recent "
        "timeline events (from " + RECENT_CUTOFF + " onward) "
        """along with their search reference materials.

Your job: determine which events have NO evidence of actually having occurred \
in the search references.

Rules:
- An event is VERIFIED if the search references contain reports of it \
actually happening
- An event is UNVERIFIED (should be removed) if:
  - The search references only contain predictions, forecasts, or speculation
  - The search references do not mention it at all
  - The search references describe it as a future plan, not a completed event
- When in doubt, keep the event (false negatives are better than false positives)
- Return remove_ids as the list of node IDs to remove
- Return reasons mapping each removed node ID to a brief explanation"""
    ),
    retries=1,
)


async def filter_hallucinations(
    nodes: list[RuntimeTimelineNode],
    *,
    detail_contexts: dict[str, str],
    topic: str,
    tavily: TavilyService,
) -> list[RuntimeTimelineNode]:
    nodes = await _filter_recent_nodes(nodes, detail_contexts)
    return await _spot_check_historical(nodes, topic, tavily)


async def _filter_recent_nodes(
    nodes: list[RuntimeTimelineNode],
    detail_contexts: dict[str, str],
) -> list[RuntimeTimelineNode]:
    recent = [node for node in nodes if node.date >= RECENT_CUTOFF]
    if not recent:
        return nodes

    lines = []
    for node in recent:
        ctx = detail_contexts.get(node.id, "No search results.")
        lines.append(
            f"--- Node {node.id}: {node.title} ({node.date}) ---\n"
            f"Description: {node.description}\n"
            f"Search references:\n{ctx}\n"
        )
    prompt = "Check these recent events:\n\n" + "\n".join(lines)

    try:
        result = await _hallucination_agent.run(prompt)
        remove_ids = set(result.output.remove_ids)
        if remove_ids:
            for node_id, reason in result.output.reasons.items():
                logger.info("Removing hallucinated node %s: %s", node_id, reason)
            return [node for node in nodes if node.id not in remove_ids]
    except Exception:
        logger.warning("Hallucination check failed, keeping all nodes")
    return nodes


async def _spot_check_historical(
    nodes: list[RuntimeTimelineNode],
    topic: str,
    tavily: TavilyService,
) -> list[RuntimeTimelineNode]:
    historical = [node for node in nodes if node.date < RECENT_CUTOFF]
    if not historical:
        return nodes

    sample_size = min(SPOT_CHECK_MAX, len(historical))
    sample = random.sample(historical, sample_size)
    logger.info(
        "Spot-checking %d historical nodes: %s",
        sample_size,
        [node.id for node in sample],
    )

    contexts: dict[str, str] = {}

    async def search_node(node: RuntimeTimelineNode) -> None:
        query = f"{topic} {node.title} {node.date[:4]}"
        try:
            ctx, _urls = await tavily.search_and_format(query, max_results=3)
            contexts[node.id] = ctx
        except Exception:
            logger.warning("Spot-check search failed for %s, skipping", node.id)
            contexts[node.id] = "No search results available."

    async with asyncio.TaskGroup() as tg:
        for node in sample:
            tg.create_task(search_node(node))

    lines = []
    for node in sample:
        ctx = contexts.get(node.id, "No search results available.")
        lines.append(
            f"--- Node {node.id}: {node.title} ({node.date}) ---\n"
            f"Description: {node.description}\n"
            f"Search references:\n{ctx}\n"
        )
    prompt = "Check these historical events:\n\n" + "\n".join(lines)

    try:
        result = await _hallucination_agent.run(prompt)
        remove_ids = set(result.output.remove_ids)
        if remove_ids:
            for node_id, reason in result.output.reasons.items():
                logger.info(
                    "Removing hallucinated historical node %s: %s",
                    node_id,
                    reason,
                )
            return [node for node in nodes if node.id not in remove_ids]
    except Exception:
        logger.warning("Historical spot-check failed, keeping all nodes")
    return nodes
