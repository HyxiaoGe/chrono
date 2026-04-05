from __future__ import annotations

import logging

from app.config import settings
from app.db.database import async_session_factory
from app.db.redis import update_session_status
from app.db.repository import save_research
from app.models.research import ResearchProposal, ResearchRequest
from app.models.runtime import RuntimeResearchState
from app.models.session import ResearchSession, SessionStatus
from app.orchestrator.event_publisher import (
    push_complete,
    push_research_error,
    push_skeleton,
    runtime_nodes_to_dicts,
)
from app.orchestrator.phases.analysis import run_analysis_phase
from app.orchestrator.phases.detail import run_detail_phase
from app.orchestrator.phases.skeleton import build_skeleton_phase
from app.orchestrator.phases.synthesis import run_synthesis_phase
from app.orchestrator.proposal import create_proposal as build_proposal
from app.services.tavily import TavilyService

logger = logging.getLogger(__name__)


def _compute_source_count(state: RuntimeResearchState) -> int:
    all_sources: set[str] = set()
    for node in state.nodes:
        all_sources.update(node.sources)
        if node.details is not None:
            all_sources.update(node.details.sources)
    return len(all_sources)


class Orchestrator:
    def __init__(self, tavily: TavilyService) -> None:
        self.tavily = tavily

    async def create_proposal(self, request: ResearchRequest) -> ResearchProposal:
        return await build_proposal(request, self.tavily)

    async def execute_research(self, session: ResearchSession) -> None:
        state = RuntimeResearchState(proposal=session.proposal)

        try:
            session.status = SessionStatus.EXECUTING

            state.nodes = await build_skeleton_phase(
                state.proposal,
                session,
                self.tavily,
                model_name=settings.milestone_model,
            )

            await run_detail_phase(
                state,
                session,
                self.tavily,
                model_name=settings.detail_model,
            )

            phase2_snapshot = state.model_copy(deep=True)

            try:
                await run_analysis_phase(
                    state,
                    session,
                    self.tavily,
                    gap_model_name=settings.gap_analysis_model,
                    detail_model_name=settings.detail_model,
                )
            except Exception:
                logger.warning("Phase 3 failed, falling back to Phase 2 snapshot")
                state = phase2_snapshot
                await push_skeleton(session, state.nodes)

            source_count = _compute_source_count(state)
            try:
                source_count = await run_synthesis_phase(
                    state,
                    session,
                    model_name=settings.synthesizer_model,
                )
            except Exception:
                logger.warning("Synthesizer failed, skipping synthesis")

            await push_complete(
                session,
                total_nodes=len(state.nodes),
                detail_completed=state.detail_completed,
            )
            session.status = SessionStatus.COMPLETED

            if async_session_factory is not None:
                try:
                    async with async_session_factory() as db:
                        await save_research(
                            db,
                            proposal=state.proposal,
                            nodes=runtime_nodes_to_dicts(state.nodes),
                            synthesis_data=state.synthesis_data,
                            total_nodes=len(state.nodes),
                            source_count=source_count,
                        )
                    logger.info("Saved research to DB: %s", state.proposal.topic)
                except Exception:
                    logger.exception("Failed to save research to DB")

            await update_session_status(
                session.session_id,
                SessionStatus.COMPLETED.value,
                cached_research_id=session.cached_research_id,
            )
        except Exception:
            logger.exception("Research execution failed")
            await push_research_error(
                session,
                message="Research execution failed. Please try again.",
            )
            session.status = SessionStatus.FAILED
            await update_session_status(
                session.session_id,
                SessionStatus.FAILED.value,
                cached_research_id=session.cached_research_id,
            )
        finally:
            await session.close()
