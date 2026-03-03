# Historical Node Spot-Check Verification — Plan

## Research Findings

### Current `_filter_hallucinations` (orchestrator.py:591-617)

```python
async def _filter_hallucinations(self, nodes: list[dict], detail_contexts: dict[str, str]) -> list[dict]:
    recent = [n for n in nodes if n["date"] >= "2025"]
    if not recent:
        return nodes
    # ... build prompt from recent nodes + detail_contexts ...
    result = await _hallucination_agent.run(prompt)
    remove_ids = set(result.output.remove_ids)
    return [n for n in nodes if n["id"] not in remove_ids]
```

Only checks `date >= "2025"` nodes. Historical nodes are never verified.

### `_hallucination_agent` prompt (orchestrator.py:468-489)

Prompt is generic: "determine which events have NO evidence of actually having occurred in the search references." Works for both recent and historical nodes — **no modification needed**.

### Tavily search (tavily.py:27-48)

`search_and_format(query, max_results=5)` returns `(formatted_context, source_urls)`. Already used in `_enrich_node` for Detail Agent. Each call costs ~1 Tavily credit.

### `detail_contexts` contents

`detail_contexts` only stores search context for `date >= "2025"` nodes (orchestrator.py:689-690). Historical nodes' search contexts are not retained. For historical spot-check, we need fresh Tavily searches.

---

## Implementation Plan

### `backend/app/orchestrator/orchestrator.py`

Modify `_filter_hallucinations` signature to accept `topic`, add historical spot-check after existing recent-nodes check.

```python
async def _filter_hallucinations(
    self, nodes: list[dict], detail_contexts: dict[str, str], topic: str
) -> list[dict]:
    # --- Existing: check all recent nodes ---
    recent = [n for n in nodes if n["date"] >= "2025"]
    if recent:
        lines = []
        for node in recent:
            ctx = detail_contexts.get(node["id"], "No search results.")
            lines.append(
                f"--- Node {node['id']}: {node['title']} ({node['date']}) ---\n"
                f"Description: {node['description']}\n"
                f"Search references:\n{ctx}\n"
            )
        prompt = "Check these recent events:\n\n" + "\n".join(lines)

        try:
            result = await _hallucination_agent.run(prompt)
            remove_ids = set(result.output.remove_ids)
            if remove_ids:
                for nid, reason in result.output.reasons.items():
                    logger.info("Removing hallucinated node %s: %s", nid, reason)
                nodes = [n for n in nodes if n["id"] not in remove_ids]
        except Exception:
            logger.warning("Hallucination check failed, keeping all nodes")

    # --- New: historical node spot-check ---
    try:
        nodes = await self._spot_check_historical(nodes, topic)
    except Exception:
        logger.warning("Historical spot-check failed, keeping all nodes")

    return nodes
```

Update call site in `execute_research()`:

```python
nodes = await self._filter_hallucinations(nodes, detail_contexts, proposal.topic)
```

Add new method `_spot_check_historical`:

```python
import random

_SPOT_CHECK_MAX = 5

async def _spot_check_historical(self, nodes: list[dict], topic: str) -> list[dict]:
    historical = [n for n in nodes if n["date"] < "2025"]
    if not historical:
        return nodes

    sample_size = min(_SPOT_CHECK_MAX, len(historical))
    sample = random.sample(historical, sample_size)
    logger.info(
        "Spot-checking %d historical nodes: %s",
        sample_size,
        [n["id"] for n in sample],
    )

    # Search each sampled node via Tavily
    contexts: dict[str, str] = {}
    async with asyncio.TaskGroup() as tg:
        async def _search_node(node: dict) -> None:
            query = f"{topic} {node['title']} {node['date'][:4]}"
            try:
                ctx, _urls = await self.tavily.search_and_format(query, max_results=3)
                contexts[node["id"]] = ctx
            except Exception:
                logger.warning("Spot-check search failed for %s, skipping", node["id"])
                contexts[node["id"]] = "No search results available."

        for node in sample:
            tg.create_task(_search_node(node))

    # Build prompt and run hallucination agent
    lines = []
    for node in sample:
        ctx = contexts.get(node["id"], "No search results available.")
        lines.append(
            f"--- Node {node['id']}: {node['title']} ({node['date']}) ---\n"
            f"Description: {node['description']}\n"
            f"Search references:\n{ctx}\n"
        )
    prompt = "Check these historical events:\n\n" + "\n".join(lines)

    result = await _hallucination_agent.run(prompt)
    remove_ids = set(result.output.remove_ids)
    if remove_ids:
        for nid, reason in result.output.reasons.items():
            logger.info("Removing hallucinated historical node %s: %s", nid, reason)
        return [n for n in nodes if n["id"] not in remove_ids]
    return nodes
```

### Design Decisions

1. **Sample size = `min(5, len(historical))`**: Cost-controlled — 5 Tavily searches + 1 LLM call max. For a 86-node Epic timeline, this is ~6% coverage.

2. **`max_results=3` for Tavily**: Spot-check only needs enough evidence to verify existence. 3 results per search keeps cost down (vs 5 in detail agent).

3. **Separate method `_spot_check_historical`**: Keeps the flow clean. The main `_filter_hallucinations` calls it with a try/except — failure doesn't affect the pipeline.

4. **Parallel Tavily searches via TaskGroup**: All 5 searches run concurrently. No semaphore needed — 5 concurrent HTTP requests is fine.

5. **Reuses `_hallucination_agent`**: Same prompt format, same output schema. The agent's instructions are generic enough ("determine which events have NO evidence") to work for historical nodes.

6. **Search query includes topic**: `f"{topic} {node['title']} {node['date'][:4]}"` — topic context prevents ambiguous titles like "柏林会议" from returning unrelated results.

7. **Search failure → "No search results available."**: Neutral phrasing consistent with Detail Agent's fallback. The hallucination agent sees no evidence but also no counter-evidence, triggering its "when in doubt, keep the event" logic.

8. **Random sampling, not deterministic**: `random.sample` ensures different nodes are checked each time a topic is re-researched. No seed — we want variety.

---

## File Change Summary

| File | Action | Description |
|------|--------|-------------|
| `backend/app/orchestrator/orchestrator.py` | Edit | Add `topic` param to `_filter_hallucinations`, add `_spot_check_historical`, update call site |

**Not changed**: hallucination agent prompt, tavily.py, detail.py, other agents, frontend, DB.

---

## Todo List

- [x] 1. Add `topic` param to `_filter_hallucinations` signature + update call site
- [x] 2. Restructure `_filter_hallucinations` to call spot-check after recent check
- [x] 3. Add `_spot_check_historical` method to `Orchestrator`
- [x] 4. Add `_SPOT_CHECK_MAX` constant and `import random`
- [x] 5. Run `ruff check && ruff format`
