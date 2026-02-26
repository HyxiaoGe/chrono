import asyncio
import logging

from pydantic_ai import Agent, UsageLimits
from pydantic_ai.models.openrouter import OpenRouterModel

from app.config import settings
from app.models.research import MilestoneResult
from app.services.llm import provider
from app.services.tavily import TavilyService

logger = logging.getLogger(__name__)

milestone_agent = Agent(
    OpenRouterModel(settings.milestone_model, provider=provider),
    output_type=MilestoneResult,
    instructions="""\
You are a milestone research specialist for the Chrono timeline system.
Your task is to discover milestone events for ONE specific research dimension of a topic.

## Input you will receive

- Topic: the overall research subject
- Research dimension: the specific angle you are responsible for
- Dimension description: what this dimension covers
- Target node count: how many nodes you should produce (allow ±20% variance)
- Search references: pre-fetched search results for your dimension

## Workflow

1. Review the provided search references for factual data, dates, and events
2. Combine with your own knowledge to build a comprehensive list for YOUR dimension
3. Sort chronologically
4. Assess significance: revolutionary (0-2 max) / high / medium
5. date: ISO format (YYYY-MM-DD). Use YYYY-01-01 if only year is known.
6. description: 2-3 sentence summary
7. sources: leave empty (system will fill automatically)

## Constraints

- Target node count ±20% — do NOT produce significantly fewer nodes than requested
- Only include events relevant to YOUR dimension, do not cross into other dimensions
- When search references conflict with your knowledge, prefer search references \
(especially for dates and numbers)""",
    retries=2,
)


async def run_milestone_agent(
    topic: str,
    thread_name: str,
    thread_description: str,
    estimated_nodes: int,
    language: str,
    tavily: TavilyService,
) -> tuple[MilestoneResult, list[str]]:
    query_main = f"{topic} {thread_name} milestones timeline history"
    query_recent = f"{topic} {thread_name} latest 2025 2026"

    try:
        (ctx_main, urls_main), (ctx_recent, urls_recent) = await asyncio.gather(
            tavily.search_and_format(query_main),
            tavily.search_and_format(query_recent),
        )
        context = f"=== 历史资料 ===\n{ctx_main}\n\n=== 近期动态 ===\n{ctx_recent}"
        all_urls = list(dict.fromkeys(urls_main + urls_recent))
    except Exception:
        logger.warning("Search failed for thread %s, proceeding without context", thread_name)
        context = "No search results available."
        all_urls = []

    prompt = (
        f"Topic: {topic}\n"
        f"Research dimension: {thread_name}\n"
        f"Dimension description: {thread_description}\n"
        f"Target node count: {estimated_nodes}\n\n"
        f"搜索参考资料:\n{context}\n\n"
        f"CRITICAL: You MUST output ALL text fields (title, subtitle, description) "
        f"in {language}. Do NOT use any other language."
    )
    result = await milestone_agent.run(
        prompt,
        usage_limits=UsageLimits(request_limit=4),
    )

    return result.output, all_urls
