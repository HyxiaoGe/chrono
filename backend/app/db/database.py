from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings

engine = None
async_session_factory: async_sessionmaker[AsyncSession] | None = None

if settings.database_url:
    engine = create_async_engine(settings.database_url, pool_size=5, max_overflow=10)
    async_session_factory = async_sessionmaker(engine, expire_on_commit=False)
