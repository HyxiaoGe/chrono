from pydantic_ai import Agent

from app.config import settings
from app.models.research import SynthesisResult
from app.services.llm import resolve_model

synthesizer_agent = Agent(
    resolve_model(settings.synthesizer_model),
    output_type=SynthesisResult,
    instructions="""\
You are the final reviewer of a Chrono timeline research. You receive a complete \
timeline with all milestone nodes and their details. Your job is to synthesize \
the research into a coherent narrative summary.

## Your Tasks

1. **Summary** (3-5 sentences): Capture the overall narrative arc — what started it, \
key turning points, where things stand now. Write as a cohesive paragraph, not bullet points.

2. **Key Insight** (1 sentence): The single most important pattern, turning point, \
or non-obvious connection you spotted across the entire timeline.

3. **Timeline Span**: State the time range covered, e.g. "2007 – 2024 (17 years)" or \
"1939 – 1945 (6 years)".

4. **Cross-Validation**: Check for inconsistencies between nodes — contradictory dates, \
conflicting claims, or suspicious gaps. List any issues found in verification_notes. \
If everything checks out, return an empty list.

5. **Date Verification**: Compare each node's date field against its description \
and details. If the date is clearly wrong (off by months or years), output a \
date_corrections entry with node_id (e.g. "ms_035"), original_date, corrected_date, \
and reason. Only flag dates you are confident are wrong — do not guess. \
Output an empty list if all dates are correct.

## Constraints

- Use the language specified in the input for all text fields
- Do NOT invent new facts — only synthesize what is present in the nodes
- The summary should feel like a professional research brief, not a list of events
- source_count: set to 0 (will be overwritten by the system)
- connections: leave empty (will be filled by the system)""",
    retries=2,
)


def _build_synthesis_prompt(topic: str, language: str, nodes: list[dict]) -> str:
    parts: list[str] = [
        f"Topic: {topic}",
        f"Language: {language}",
        f"Total nodes: {len(nodes)}",
        "",
    ]

    for i, node in enumerate(nodes, start=1):
        node_id = node.get("id", f"ms_{i:03d}")
        parts.append(f"### Node {i} [{node_id}]: {node.get('title', '')} ({node.get('date', '')})")
        parts.append(f"- Significance: {node.get('significance', '')}")
        parts.append(f"- Description: {node.get('description', '')}")

        if details := node.get("details"):
            if kf := details.get("key_features"):
                parts.append(f"- Key Features: {'; '.join(kf)}")
            if impact := details.get("impact"):
                parts.append(f"- Impact: {impact}")
            if kp := details.get("key_people"):
                parts.append(f"- Key People: {'; '.join(kp)}")
            if ctx := details.get("context"):
                parts.append(f"- Context: {ctx}")
        else:
            parts.append("- (Details not available for this node)")

        parts.append("")

    return "\n".join(parts)


async def run_synthesizer_agent(
    topic: str,
    language: str,
    nodes: list[dict],
) -> SynthesisResult:
    prompt = _build_synthesis_prompt(topic, language, nodes)
    result = await synthesizer_agent.run(prompt)
    return result.output
