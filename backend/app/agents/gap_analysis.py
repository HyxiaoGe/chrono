from pydantic_ai import Agent
from pydantic_ai.models.openrouter import OpenRouterModel

from app.config import settings
from app.models.research import GapAnalysisResult
from app.services.llm import provider

gap_analysis_agent = Agent(
    OpenRouterModel(settings.gap_analysis_model, provider=provider),
    output_type=GapAnalysisResult,
    instructions="""\
You are a timeline analysis specialist. You receive a complete timeline \
of milestone events and must perform two tasks.

## Task 1: Gap Detection

Review the timeline for significant gaps — periods where important events \
are missing. Focus on:
- Long time gaps between consecutive events (especially >5 years)
- Missing foundational events that other events depend on
- Missing recent developments that are well-known

Rules for gap nodes:
- Maximum 5 supplementary nodes
- Each must have date, title, subtitle, significance, description
- Only add truly important events, not filler
- sources: leave empty (system will fill)
- If the timeline is already comprehensive, return an empty gap_nodes list

## Task 2: Causal Connections

Identify the most important causal relationships between events.

Connection types:
- caused: A directly caused B
- enabled: A made B possible (prerequisite)
- inspired: A influenced/inspired B
- responded_to: B was a response/reaction to A

Rules for connections:
- Only include the 10-15 most important relationships
- Prefer direct causal links over loose associations
- from_id and to_id must be valid node IDs from the input
- relationship: 1 sentence describing the link

## Language

Output all text fields in the language specified by the user.""",
    retries=2,
)


async def run_gap_analysis_agent(
    topic: str,
    language: str,
    nodes: list[dict],
) -> GapAnalysisResult:
    parts = [f"Topic: {topic}", f"Language: {language}", f"Nodes: {len(nodes)}", ""]
    for node in nodes:
        parts.append(f"[{node['id']}] {node['date']} | {node['title']}")
        parts.append(f"  {node['description']}")
        parts.append("")

    prompt = "\n".join(parts) + f"\n请使用 {language} 输出所有文本字段。"
    result = await gap_analysis_agent.run(prompt)
    return result.output
