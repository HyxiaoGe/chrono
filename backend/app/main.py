import asyncio
import copy
import logging
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from sse_starlette import EventSourceResponse

from app.data.recommended import RECOMMENDED_TOPICS
from app.db.database import async_session_factory, engine
from app.db.redis import (
    cache_proposal,
    close_redis,
    get_cached_proposal,
    get_session_data,
    store_session,
    update_session_status,
)
from app.db.replay import replay_research
from app.db.repository import get_research_by_topic, list_researches
from app.models.research import (
    ErrorResponse,
    ResearchProposal,
    ResearchProposalResponse,
    ResearchRequest,
)
from app.models.session import SessionManager, SessionStatus
from app.orchestrator.orchestrator import Orchestrator
from app.services.tavily import TavilyService
from app.utils.topic import normalize_topic

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await close_redis()
    if engine is not None:
        await engine.dispose()


logging.basicConfig(level=logging.INFO)
app = FastAPI(title="Chrono API", lifespan=lifespan)
tavily_service = TavilyService()
session_manager = SessionManager()
orchestrator = Orchestrator(tavily=tavily_service)


@app.get("/api/researches")
async def list_researches_endpoint(locale: str | None = None):
    if async_session_factory is None:
        return []
    async with async_session_factory() as db:
        rows = await list_researches(db)
    if locale:
        rows = [r for r in rows if (r.language or "").startswith(locale)]
    return [
        {
            "id": str(row.id),
            "topic": row.topic,
            "topic_type": row.topic_type,
            "language": row.language,
            "complexity_level": row.complexity_level,
            "total_nodes": row.total_nodes,
            "source_count": row.source_count,
            "created_at": row.created_at.isoformat(),
            "timeline_span": row.synthesis.get("timeline_span", "") if row.synthesis else "",
            "key_insight": row.synthesis.get("key_insight", "") if row.synthesis else "",
        }
        for row in rows
    ]


@app.get("/api/topics/recommended")
async def get_recommended_topics(locale: str = "en") -> list[dict]:
    lang = locale if locale in RECOMMENDED_TOPICS else "en"
    categories = copy.deepcopy(RECOMMENDED_TOPICS[lang])
    cached_set: set[str] = set()
    if async_session_factory is not None:
        try:
            async with async_session_factory() as db:
                rows = await list_researches(db)
            cached_set = {normalize_topic(r.topic) for r in rows}
        except Exception:
            pass
    for cat in categories:
        for topic in cat["topics"]:
            topic["cached"] = normalize_topic(topic["title"]) in cached_set
    return categories


@app.post(
    "/api/research",
    response_model=ResearchProposalResponse,
    responses={502: {"model": ErrorResponse}},
)
async def create_research(request: ResearchRequest) -> ResearchProposalResponse:
    session_id = str(uuid.uuid4())
    normalized = normalize_topic(request.topic)

    # Layer 1: DB cache (completed research — full replay)
    if async_session_factory is not None:
        try:
            async with async_session_factory() as db:
                db_cached = await get_research_by_topic(db, request.topic)
            if db_cached:
                proposal = ResearchProposal.model_validate(db_cached.proposal)
                session = session_manager.create(session_id, proposal)
                session.cached_research_id = db_cached.id
                logger.info("DB cache hit for topic: %s", request.topic)
                await store_session(session_id, proposal.model_dump(), "proposal_ready")
                return ResearchProposalResponse(
                    session_id=session_id,
                    proposal=proposal,
                    cached=True,
                )
        except Exception:
            logger.warning("DB cache lookup failed, falling back")

    # Layer 2: Redis proposal cache (generated but not yet researched)
    cached_dict = await get_cached_proposal(normalized)
    if cached_dict is not None:
        try:
            proposal = ResearchProposal.model_validate(cached_dict)
            logger.info("Redis proposal cache hit for topic: %s", request.topic)
            session_manager.create(session_id, proposal)
            await store_session(session_id, proposal.model_dump(), "proposal_ready")
            return ResearchProposalResponse(session_id=session_id, proposal=proposal)
        except Exception:
            logger.warning("Redis proposal validation failed, falling back to LLM")

    # Layer 3: Fresh LLM call
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

    await cache_proposal(normalized, proposal.model_dump())
    session_manager.create(session_id, proposal)
    await store_session(session_id, proposal.model_dump(), "proposal_ready")
    return ResearchProposalResponse(session_id=session_id, proposal=proposal)


@app.get("/api/research/{session_id}/status")
async def get_session_status(session_id: str):
    # Layer 1: in-memory
    session = session_manager.get(session_id)
    if session is not None:
        return {
            "status": session.status.value,
            "proposal": session.proposal.model_dump(),
        }

    # Layer 2: Redis
    redis_data = await get_session_data(session_id)
    if redis_data is not None:
        return {
            "status": redis_data["status"],
            "proposal": redis_data["proposal"],
        }

    raise HTTPException(status_code=404, detail="Session not found")


@app.get("/api/research/{session_id}/stream")
async def stream_research(session_id: str, request: Request) -> EventSourceResponse:
    session = session_manager.get(session_id)

    # Not in memory — try reconstructing from Redis
    if session is None:
        redis_data = await get_session_data(session_id)
        if redis_data is not None:
            try:
                proposal = ResearchProposal.model_validate(redis_data["proposal"])
                session = session_manager.create(session_id, proposal)
                logger.info("Reconstructed session %s from Redis", session_id)

                if async_session_factory is not None:
                    try:
                        async with async_session_factory() as db:
                            cached = await get_research_by_topic(db, proposal.topic)
                        if cached:
                            session.cached_research_id = cached.id
                    except Exception:
                        pass
            except Exception:
                logger.warning("Failed to reconstruct session from Redis", exc_info=True)

    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.status == SessionStatus.FAILED:
        raise HTTPException(status_code=410, detail="Session failed")

    if session.status == SessionStatus.PROPOSAL_READY:
        # First connect — start execution
        await update_session_status(session_id, "executing")
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

    # EXECUTING or COMPLETED — reconnection / replay
    return EventSourceResponse(
        session.replay_and_stream(request),
        ping=15,
        send_timeout=30,
        headers={"X-Accel-Buffering": "no"},
    )
