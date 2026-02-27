import asyncio
import logging
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from sse_starlette import EventSourceResponse

from app.db.database import async_session_factory, engine
from app.db.replay import replay_research
from app.db.repository import get_research_by_topic
from app.models.research import (
    ErrorResponse,
    ResearchProposalResponse,
    ResearchRequest,
)
from app.models.session import SessionManager, SessionStatus
from app.orchestrator.orchestrator import Orchestrator
from app.services.tavily import TavilyService

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    if engine is not None:
        await engine.dispose()


logging.basicConfig(level=logging.INFO)
app = FastAPI(title="Chrono API", lifespan=lifespan)
tavily_service = TavilyService()
session_manager = SessionManager()
orchestrator = Orchestrator(tavily=tavily_service)


@app.post(
    "/api/research",
    response_model=ResearchProposalResponse,
    responses={502: {"model": ErrorResponse}},
)
async def create_research(request: ResearchRequest) -> ResearchProposalResponse:
    session_id = str(uuid.uuid4())

    # Cache check
    if async_session_factory is not None:
        try:
            async with async_session_factory() as db:
                cached = await get_research_by_topic(db, request.topic)
            if cached:
                from app.models.research import ResearchProposal

                proposal = ResearchProposal.model_validate(cached.proposal)
                session = session_manager.create(session_id, proposal)
                session.cached_research_id = cached.id
                logger.info("Cache hit for topic: %s", request.topic)
                return ResearchProposalResponse(session_id=session_id, proposal=proposal)
        except Exception:
            logger.warning("Cache lookup failed, falling back to fresh research")

    try:
        proposal = await orchestrator.create_proposal(request)
    except Exception as exc:
        logger.exception("Failed to create research proposal")
        raise HTTPException(
            status_code=502,
            detail=ErrorResponse(
                error="llm_service_unavailable",
                message="Failed to generate research proposal. Please try again.",
            ).model_dump(),
        ) from exc
    session_manager.create(session_id, proposal)
    return ResearchProposalResponse(session_id=session_id, proposal=proposal)


@app.get("/api/research/{session_id}/stream")
async def stream_research(session_id: str, request: Request) -> EventSourceResponse:
    session = session_manager.get(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.status != SessionStatus.PROPOSAL_READY:
        raise HTTPException(status_code=409, detail="Session already started or completed")

    if session.cached_research_id is not None:
        session.task = asyncio.create_task(replay_research(session, session.cached_research_id))
    else:
        session.task = asyncio.create_task(orchestrator.execute_research(session))

    return EventSourceResponse(
        session.event_generator(request),
        ping=15,
        send_timeout=30,
        headers={"X-Accel-Buffering": "no"},
    )
