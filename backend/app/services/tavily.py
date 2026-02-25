from tavily import AsyncTavilyClient

from app.config import settings


class TavilyService:
    def __init__(self) -> None:
        self._client = AsyncTavilyClient(api_key=settings.tavily_api_key)

    async def search(
        self,
        query: str,
        *,
        max_results: int = 5,
        search_depth: str = "basic",
        topic: str = "general",
        include_answer: bool = True,
    ) -> dict:
        return await self._client.search(
            query=query,
            max_results=max_results,
            search_depth=search_depth,
            topic=topic,
            include_answer=include_answer,
        )
