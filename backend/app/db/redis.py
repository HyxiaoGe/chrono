from __future__ import annotations

import json
import logging
from typing import Any

import redis.asyncio as aioredis

from app.config import settings

logger = logging.getLogger(__name__)

_redis: aioredis.Redis | None = None

PROPOSAL_TTL = 86400  # 24 hours


def get_redis() -> aioredis.Redis | None:
    """Lazy-init Redis connection. Returns None if redis_url is empty."""
    global _redis
    if _redis is not None:
        return _redis
    if not settings.redis_url:
        return None
    _redis = aioredis.from_url(
        settings.redis_url,
        decode_responses=True,
    )
    return _redis


def _proposal_key(normalized_topic: str) -> str:
    return f"chrono:proposal:{normalized_topic}"


async def get_cached_proposal(normalized_topic: str) -> dict[str, Any] | None:
    r = get_redis()
    if r is None:
        return None
    try:
        raw = await r.get(_proposal_key(normalized_topic))
        if raw is None:
            return None
        return json.loads(raw)
    except Exception:
        logger.warning("Redis get_cached_proposal failed", exc_info=True)
        return None


async def cache_proposal(normalized_topic: str, proposal_dict: dict[str, Any]) -> None:
    r = get_redis()
    if r is None:
        return
    try:
        await r.set(
            _proposal_key(normalized_topic),
            json.dumps(proposal_dict, ensure_ascii=False),
            ex=PROPOSAL_TTL,
        )
    except Exception:
        logger.warning("Redis cache_proposal failed", exc_info=True)


async def delete_cached_proposal(normalized_topic: str) -> None:
    r = get_redis()
    if r is None:
        return
    try:
        await r.delete(_proposal_key(normalized_topic))
    except Exception:
        logger.warning("Redis delete_cached_proposal failed", exc_info=True)


# ---------- Session persistence ----------

SESSION_TTL = 86400  # 24 hours


def _session_key(session_id: str) -> str:
    return f"chrono:session:{session_id}"


async def store_session(
    session_id: str,
    proposal_dict: dict[str, Any],
    status: str = "proposal_ready",
    *,
    cached_research_id: str | None = None,
) -> None:
    r = get_redis()
    if r is None:
        return
    try:
        await r.set(
            _session_key(session_id),
            json.dumps(
                {
                    "proposal": proposal_dict,
                    "status": status,
                    "cached_research_id": cached_research_id,
                },
                ensure_ascii=False,
            ),
            ex=SESSION_TTL,
        )
    except Exception:
        logger.warning("Redis store_session failed", exc_info=True)


async def get_session_data(session_id: str) -> dict[str, Any] | None:
    r = get_redis()
    if r is None:
        return None
    try:
        raw = await r.get(_session_key(session_id))
        if raw is None:
            return None
        return json.loads(raw)
    except Exception:
        logger.warning("Redis get_session_data failed", exc_info=True)
        return None


async def update_session_status(
    session_id: str,
    status: str,
    *,
    cached_research_id: Any | None = None,
) -> None:
    r = get_redis()
    if r is None:
        return
    try:
        raw = await r.get(_session_key(session_id))
        if raw is None:
            return
        data = json.loads(raw)
        data["status"] = status
        if cached_research_id is not None:
            data["cached_research_id"] = str(cached_research_id)
        await r.set(
            _session_key(session_id),
            json.dumps(data, ensure_ascii=False),
            ex=SESSION_TTL,
        )
    except Exception:
        logger.warning("Redis update_session_status failed", exc_info=True)


async def close_redis() -> None:
    global _redis
    if _redis is not None:
        await _redis.aclose()
        _redis = None
