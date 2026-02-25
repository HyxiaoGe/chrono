import asyncio
import logging
import uuid

from fastapi import FastAPI, HTTPException, Request
from sse_starlette import EventSourceResponse

from app.models.research import (
    ErrorResponse,
    ResearchProposalResponse,
    ResearchRequest,
)
from app.models.session import SessionManager, SessionStatus
from app.orchestrator.orchestrator import Orchestrator
from app.services.tavily import TavilyService

logger = logging.getLogger(__name__)

app = FastAPI(title="Chrono API")
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

    session.task = asyncio.create_task(orchestrator.execute_research(session))

    return EventSourceResponse(
        session.event_generator(request),
        ping=15,
        send_timeout=30,
        headers={"X-Accel-Buffering": "no"},
    )
