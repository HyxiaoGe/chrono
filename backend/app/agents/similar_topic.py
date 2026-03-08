from pydantic import BaseModel
from pydantic_ai import Agent

from app.config import settings
from app.services.llm import resolve_model


class SimilarTopicResult(BaseModel):
    matched_topic: str | None = None


_similar_topic_agent = Agent(
    resolve_model(settings.similar_topic_model),
    output_type=SimilarTopicResult,
    instructions="""\
You are a topic similarity detector. Given a NEW topic and a list of EXISTING topics, \
determine if the new topic is semantically the same as any existing topic.

## Rules

- Two topics are "the same" if a user searching for one would be satisfied \
with the research results of the other
- Cross-language synonyms count as the same: "iPhone" = "苹果手机", \
"AI" = "人工智能", "Bitcoin" = "比特币"
- Related but different scope is NOT the same: "AI" ≠ "AI 芯片", \
"iPhone" ≠ "苹果公司", "二战" ≠ "一战"
- If multiple existing topics match, return the most relevant one
- If no match, return matched_topic as null

## Output

Return the EXACT text of the matched existing topic (not a rewrite), or null.""",
    retries=1,
)


async def find_similar_topic(
    new_topic: str,
    existing_topics: list[str],
) -> str | None:
    if not existing_topics:
        return None

    topic_list = "\n".join(f"- {t}" for t in existing_topics)
    prompt = f"NEW topic: {new_topic}\n\nEXISTING topics:\n{topic_list}"

    result = await _similar_topic_agent.run(prompt)
    matched = result.output.matched_topic

    if matched:
        matched_stripped = matched.strip()
        for t in existing_topics:
            if t.strip().lower() == matched_stripped.lower():
                return t
    return None
