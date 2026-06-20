import copy
import logging
import os
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.agents.similar_topic import find_similar_topic
from app.data.recommended import RECOMMENDED_TOPICS
from app.db.database import async_session_factory, engine
from app.db.redis import (
    cache_proposal,
    close_redis,
    get_cached_proposal,
    get_redis,
    store_session,
)
from app.db.repository import (
    get_cached_research_proposal_by_topic,
    list_cached_topic_normalized,
    list_researches,
    list_topic_candidates,
)
from app.models.research import (
    ErrorResponse,
    ResearchProposal,
    ResearchProposalResponse,
    ResearchRequest,
    SimilarTopicMatch,
)
from app.models.session import SessionManager
from app.orchestrator.orchestrator import Orchestrator
from app.services.tavily import TavilyService
from app.session.lifecycle import SessionLifecycleService
from app.utils.topic import normalize_topic

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await close_redis()
    if engine is not None:
        await engine.dispose()


logging.basicConfig(level=logging.INFO)
_enable_docs = os.getenv("ENABLE_DOCS", "true").lower() == "true"
app = FastAPI(
    title="Chrono API",
    lifespan=lifespan,
    docs_url="/docs" if _enable_docs else None,
    redoc_url="/redoc" if _enable_docs else None,
    openapi_url="/openapi.json" if _enable_docs else None,
)
tavily_service = TavilyService()
session_manager = SessionManager()
orchestrator = Orchestrator(tavily=tavily_service)
lifecycle_service = SessionLifecycleService(session_manager)


@app.get("/health")
async def health_check() -> JSONResponse:
    checks: dict[str, str] = {}
    healthy = True

    if async_session_factory is None:
        checks["database"] = "not_configured"
    else:
        try:
            async with async_session_factory() as db:
                await db.execute(text("SELECT 1"))
            checks["database"] = "ok"
        except Exception as exc:
            checks["database"] = f"error: {exc}"
            healthy = False

    redis_client = get_redis()
    if redis_client is None:
        checks["redis"] = "not_configured"
    else:
        try:
            await redis_client.ping()
            checks["redis"] = "ok"
        except Exception as exc:
            checks["redis"] = f"error: {exc}"
            healthy = False

    return JSONResponse(
        status_code=200 if healthy else 503,
        content={
            "status": "healthy" if healthy else "unhealthy",
            "service": "chrono-backend",
            "checks": checks,
        },
    )


@app.get("/api/researches")
async def list_researches_endpoint(
    locale: str | None = None,
    limit: int = Query(50, ge=1, le=100),
):
    if async_session_factory is None:
        return []
    async with async_session_factory() as db:
        rows = await list_researches(db, locale=locale, limit=limit)
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
            "timeline_span": row.timeline_span or "",
            "key_insight": row.key_insight or "",
        }
        for row in rows
    ]


@app.get("/api/topics/recommended")
async def get_recommended_topics(locale: str = "en") -> list[dict]:
    lang = locale if locale in RECOMMENDED_TOPICS else "en"
    categories = copy.deepcopy(RECOMMENDED_TOPICS[lang])
    candidate_topics = {
        normalize_topic(topic["title"]) for category in categories for topic in category["topics"]
    }
    cached_set: set[str] = set()
    if async_session_factory is not None:
        try:
            async with async_session_factory() as db:
                cached_set = set(
                    await list_cached_topic_normalized(db, candidates=candidate_topics)
                )
        except Exception:
            pass
    for cat in categories:
        for topic in cat["topics"]:
            key = normalize_topic(topic["title"])
            topic["cached"] = any(key in cached or cached in key for cached in cached_set)
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
                db_cached = await get_cached_research_proposal_by_topic(db, request.topic)
            if db_cached:
                proposal = ResearchProposal.model_validate(db_cached.proposal)
                session_manager.create(
                    session_id,
                    proposal,
                    cached_research_id=db_cached.id,
                )
                logger.info("DB cache hit for topic: %s", request.topic)
                await store_session(
                    session_id,
                    proposal.model_dump(),
                    "proposal_ready",
                    cached_research_id=str(db_cached.id),
                )
                return ResearchProposalResponse(
                    session_id=session_id,
                    proposal=proposal,
                    cached=True,
                )
        except Exception:
            logger.warning("DB cache lookup failed, falling back")

    # Layer 1.5: LLM similar topic detection (skip if force=True)
    if not request.force and async_session_factory is not None:
        try:
            async with async_session_factory() as db:
                candidates = await list_topic_candidates(db)
            if candidates:
                existing_topics = [c[0] for c in candidates]
                matched = await find_similar_topic(request.topic, existing_topics)
                if matched:
                    match_row = next(c for c in candidates if c[0] == matched)
                    logger.info(
                        "Similar topic found: '%s' ≈ '%s'",
                        request.topic,
                        matched,
                    )
                    return ResearchProposalResponse(
                        similar_topic=SimilarTopicMatch(
                            topic=matched,
                            research_id=str(match_row[2]),
                        ),
                    )
        except Exception:
            logger.warning("Similar topic check failed, falling back")

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
    payload = await lifecycle_service.get_status_payload(session_id)
    if payload is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return payload


@app.get("/api/research/{session_id}/stream")
async def stream_research(session_id: str, request: Request):
    session = await lifecycle_service.get_or_restore_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return await lifecycle_service.create_stream_response(
        session,
        request,
        execute_research=orchestrator.execute_research,
    )
