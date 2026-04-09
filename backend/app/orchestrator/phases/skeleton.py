from __future__ import annotations

import asyncio
import logging

from app.agents.milestone import run_milestone_agent
from app.models.research import ResearchPhase, ResearchProposal, ResearchThread
from app.models.runtime import RuntimeTimelineNode
from app.models.session import ResearchSession
from app.orchestrator.dedup import merge_and_dedup_runtime_nodes
from app.orchestrator.event_publisher import friendly_model_name, push_progress, push_skeleton
from app.orchestrator.messages import get_progress_message
from app.services.tavily import TavilyService

logger = logging.getLogger(__name__)

MILESTONE_CONCURRENCY = 8


async def build_skeleton_phase(
    proposal: ResearchProposal,
    session: ResearchSession,
    tavily: TavilyService,
    *,
    model_name: str,
) -> list[RuntimeTimelineNode]:
    await push_progress(
        session,
        phase="skeleton",
        message=get_progress_message("skeleton", proposal.language),
        model=friendly_model_name(model_name),
    )

    sem = asyncio.Semaphore(MILESTONE_CONCURRENCY)
    partial_counter = 0
    raw_counter = 0

    async def run_thread(
        thread: ResearchThread,
        *,
        time_range: str = "",
        phase_name: str | None = None,
    ) -> list[RuntimeTimelineNode]:
        nonlocal partial_counter, raw_counter
        async with sem:
            try:
                milestone_result, urls = await run_milestone_agent(
                    topic=proposal.topic,
                    thread_name=thread.name,
                    thread_description=thread.description,
                    estimated_nodes=thread.estimated_nodes,
                    language=proposal.language,
                    tavily=tavily,
                    time_range=time_range,
                )
            except Exception:
                logger.warning("Milestone agent failed for thread: %s", thread.name)
                return []

        runtime_nodes: list[RuntimeTimelineNode] = []
        partial_nodes: list[RuntimeTimelineNode] = []
        for node in milestone_result.nodes:
            node.sources = urls
            raw_counter += 1
            runtime = RuntimeTimelineNode.from_skeleton(
                node,
                node_id=f"raw_{raw_counter:03d}",
                phase_name=phase_name,
            )
            runtime_nodes.append(runtime)

            partial_counter += 1
            partial_nodes.append(runtime.model_copy(update={"id": f"tmp_{partial_counter:03d}"}))

        if partial_nodes:
            await push_skeleton(session, partial_nodes, partial=True)
            await push_progress(
                session,
                phase="skeleton",
                message=get_progress_message("skeleton_thread", proposal.language).format(
                    count=len(partial_nodes),
                    thread=thread.name,
                ),
            )
        return runtime_nodes

    if proposal.research_phases:
        raw_nodes = await _build_phased_skeleton(proposal.research_phases, run_thread)
    else:
        async with asyncio.TaskGroup() as tg:
            tasks = [tg.create_task(run_thread(thread)) for thread in proposal.research_threads]
        raw_nodes = []
        for task in tasks:
            raw_nodes.extend(task.result())

    nodes = await merge_and_dedup_runtime_nodes(raw_nodes, proposal.language)
    await push_skeleton(session, nodes)
    return nodes


async def _build_phased_skeleton(
    phases: list[ResearchPhase],
    run_thread: callable,
) -> list[RuntimeTimelineNode]:
    async def run_phase(phase: ResearchPhase) -> list[RuntimeTimelineNode]:
        async with asyncio.TaskGroup() as tg:
            tasks = [
                tg.create_task(
                    run_thread(
                        thread,
                        time_range=phase.time_range,
                        phase_name=phase.name,
                    )
                )
                for thread in phase.threads
            ]
        nodes: list[RuntimeTimelineNode] = []
        for task in tasks:
            nodes.extend(task.result())
        return nodes

    async with asyncio.TaskGroup() as tg:
        tasks = [tg.create_task(run_phase(phase)) for phase in phases]
    all_nodes: list[RuntimeTimelineNode] = []
    for task in tasks:
        all_nodes.extend(task.result())
    return all_nodes
