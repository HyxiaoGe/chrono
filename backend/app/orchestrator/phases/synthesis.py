from __future__ import annotations

import logging

from app.agents.synthesizer import run_synthesizer_agent
from app.models.runtime import RuntimeResearchState
from app.models.session import ResearchSession
from app.orchestrator.event_publisher import (
    friendly_model_name,
    push_progress,
    push_skeleton,
    push_synthesis,
)
from app.orchestrator.messages import get_progress_message

logger = logging.getLogger(__name__)


async def run_synthesis_phase(
    state: RuntimeResearchState,
    session: ResearchSession,
    *,
    model_name: str,
) -> int:
    await push_progress(
        session,
        phase="synthesis",
        message=get_progress_message("synthesis", state.proposal.language),
        model=friendly_model_name(model_name),
    )

    all_sources: set[str] = set()
    for node in state.nodes:
        all_sources.update(node.sources)
        if node.details is not None:
            all_sources.update(node.details.sources)
    source_count = len(all_sources)

    synthesis = await run_synthesizer_agent(
        topic=state.proposal.topic,
        language=state.proposal.language,
        nodes=[node.to_sse_dict() for node in state.nodes],
    )
    synthesis_data = synthesis.model_dump()
    synthesis_data["source_count"] = source_count
    synthesis_data["connections"] = [conn.model_dump() for conn in state.gap_connections]
    synthesis_data["date_corrections"] = (
        [correction.model_dump() for correction in synthesis.date_corrections]
        if synthesis.date_corrections
        else []
    )
    state.synthesis_data = synthesis_data
    await push_synthesis(session, synthesis_data)

    if synthesis.date_corrections:
        node_map = {node.id: node for node in state.nodes}
        updated_nodes = list(state.nodes)
        for correction in synthesis.date_corrections:
            node = node_map.get(correction.node_id)
            if node is None:
                continue
            updated = node.with_date(correction.corrected_date)
            updated_nodes[updated_nodes.index(node)] = updated
            logger.info(
                "Date corrected %s: %s -> %s (%s)",
                correction.node_id,
                correction.original_date,
                correction.corrected_date,
                correction.reason,
            )
        state.nodes = sorted(updated_nodes, key=lambda node: node.date)
        await push_skeleton(session, state.nodes)

    return source_count
