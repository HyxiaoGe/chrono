from typing import Any


def format_search_results(response: dict[str, Any]) -> str:
    """Format Tavily search response into a readable string for LLM consumption."""
    parts: list[str] = []
    if answer := response.get("answer"):
        parts.append(f"Summary: {answer}\n")
    for r in response.get("results", []):
        content = r.get("content", "")[:300]
        parts.append(f"- [{r['title']}]({r['url']})\n  {content}")
    return "\n".join(parts) if parts else "No results found."
