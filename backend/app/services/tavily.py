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

    async def search_and_format(
        self,
        query: str,
        *,
        max_results: int = 5,
    ) -> tuple[str, list[str]]:
        """Search and return (formatted_context, source_urls)."""
        response = await self.search(query, max_results=max_results)
        results = response.get("results", [])

        parts: list[str] = []
        urls: list[str] = []
        for i, r in enumerate(results, 1):
            url = r.get("url", "")
            title = r.get("title", "")
            snippet = r.get("content", "")[:300]
            parts.append(f"【{i}】{title}\nURL: {url}\n{snippet}")
            if url:
                urls.append(url)

        context = "\n\n".join(parts) if parts else "No search results found."
        return context, urls
