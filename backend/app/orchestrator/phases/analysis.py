from __future__ import annotations

import logging

from app.agents.gap_analysis import run_gap_analysis_agent
from app.models.runtime import RuntimeResearchState, RuntimeTimelineNode
from app.models.session import ResearchSession
from app.orchestrator.event_publisher import friendly_model_name, push_progress, push_skeleton
from app.orchestrator.messages import get_progress_message
from app.orchestrator.phases.detail import enrich_nodes
from app.orchestrator.verification import filter_hallucinations
from app.services.tavily import TavilyService

logger = logging.getLogger(__name__)


async def run_analysis_phase(
    state: RuntimeResearchState,
    session: ResearchSession,
    tavily: TavilyService,
    *,
    gap_model_name: str,
    detail_model_name: str,
) -> None:
    await push_progress(
        session,
        phase="analysis",
        message=get_progress_message("analysis", state.proposal.language),
        model=friendly_model_name(gap_model_name),
    )

    await push_progress(
        session,
        phase="analysis",
        message=get_progress_message("analysis_hallucination", state.proposal.language),
        model=friendly_model_name(gap_model_name),
    )
    state.nodes = await filter_hallucinations(
        state.nodes,
        detail_contexts=state.detail_contexts,
        topic=state.proposal.topic,
        tavily=tavily,
    )

    await push_progress(
        session,
        phase="analysis",
        message=get_progress_message("analysis_gap", state.proposal.language),
        model=friendly_model_name(gap_model_name),
    )
    gap_result = await run_gap_analysis_agent(
        topic=state.proposal.topic,
        language=state.proposal.language,
        nodes=[node.to_sse_dict() for node in state.nodes],
    )
    state.gap_connections = gap_result.connections

    new_nodes: list[RuntimeTimelineNode] = []
    for gap_node in gap_result.gap_nodes:
        new_nodes.append(
            RuntimeTimelineNode.from_skeleton(
                gap_node,
                node_id=state.next_node_id(),
                phase_name=None,
                is_gap_node=True,
            )
        )
        state.nodes.append(new_nodes[-1])

    state.nodes = sorted(state.nodes, key=lambda node: node.date)
    await push_skeleton(session, state.nodes)

    if new_nodes:
        await push_progress(
            session,
            phase="analysis",
            message=get_progress_message("analysis_gap_found", state.proposal.language).format(
                count=len(new_nodes)
            ),
            model=friendly_model_name(detail_model_name),
        )
        await enrich_nodes(state, session, tavily, new_nodes)
