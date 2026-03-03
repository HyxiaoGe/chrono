# P2 Pipeline Performance & Reliability Hardening — Plan

## Research Findings

### Detail Agent — Current Architecture

`detail_agent` is a **module-level singleton** (`detail.py:18`) created with `resolve_model(settings.detail_model)`. `run_detail_agent()` calls `detail_agent.run(prompt, usage_limits=...)`.

Pydantic AI supports **runtime model override**: `agent.run(prompt, model=resolve_model(...))` — confirmed from source. The `model` parameter accepts `Model | KnownModelName | str | None`. When provided, it overrides the agent's default model for that single run. This means we don't need to create new Agent instances per provider — just pass `model=` to each `run()` call.

`resolve_model()` (`llm.py:59`) already handles arbitrary `"provider:model_name"` strings and caches provider instances internally (`_provider_cache`). Calling it multiple times with different strings is cheap.

### Pipeline Error Handling — Current State

Phase 3 (Hallucination + Gap Analysis):
- `_filter_hallucinations` (line 689): **No try/except wrapper** — if the hallucination agent throws, the exception propagates to the outer try/except at line 801, which marks the entire session as FAILED.
- `_run_gap_analysis` (line 692): Has its own internal try/except — returns empty `GapAnalysisResult` on failure. Safe.
- Gap node enrichment (line 716-719): Uses `asyncio.TaskGroup` — if any task fails, it raises `ExceptionGroup`. Individual `_enrich_node` calls have try/except inside, so this is safe in practice.

Phase 4 (Synthesis):
- Already wrapped in try/except (line 741-773) — skips synthesis on failure. Safe.

**Key gap**: Phase 3a (`_filter_hallucinations`) can crash the entire pipeline. Even though `_filter_hallucinations` has an internal try/except for the LLM call, the `recent = [n for n in nodes if ...]` or other pre-processing could fail. More importantly, an `ExceptionGroup` from Phase 2's TaskGroup (if it propagates oddly) or unexpected data issues could crash Phase 3.

### DB Cache — Current State

- `ResearchRow.topic` has `unique=True, index=True` (models.py:19)
- `get_research_by_topic()` does **exact match**: `WHERE topic == topic` (repository.py:14)
- `save_research()` does upsert by exact topic match (repository.py:50)
- Two existing Alembic migrations:
  1. `6742430d2911` — initial schema (researches + timeline_nodes)
  2. `fa54caecf7c9` — add phase_name to timeline_nodes
- Alembic env uses `settings.database_url` with async engine

---

## Implementation Plan

### Change 1: Detail Agent Multi-Provider Pool

#### `backend/app/config.py`

Add one field:
```python
detail_model_pool: str = ""  # comma-separated model strings; empty = fallback to detail_model
```

#### `backend/app/agents/detail.py`

Add `model_override` parameter to `run_detail_agent`:

```python
from pydantic_ai.models import Model

async def run_detail_agent(
    node: dict,
    topic: str,
    language: str,
    tavily: TavilyService,
    model_override: Model | None = None,
) -> tuple[NodeDetail, str]:
    ...
    result = await detail_agent.run(
        prompt,
        model=model_override,  # None = use agent's default model
        usage_limits=UsageLimits(request_limit=4),
    )
    ...
```

When `model_override` is `None`, Pydantic AI uses the agent's default model (set at construction). When provided, it overrides for that run only.

#### `backend/app/orchestrator/orchestrator.py`

Parse pool at module level:

```python
from app.services.llm import resolve_model as _resolve_model

def _build_detail_pool() -> list[Model]:
    if not settings.detail_model_pool:
        return []
    pool: list[Model] = []
    for s in settings.detail_model_pool.split(","):
        s = s.strip()
        if not s:
            continue
        try:
            pool.append(_resolve_model(s))
        except ValueError:
            logger.warning("Skipping invalid pool model: %s", s)
    return pool

_detail_pool = _build_detail_pool()
```

In `execute_research()`, modify `_enrich_node` closure:

```python
pool_counter = 0

async def _enrich_node(node: dict) -> None:
    nonlocal detail_completed, pool_counter
    async with sem:
        model_override = None
        if _detail_pool:
            model_override = _detail_pool[pool_counter % len(_detail_pool)]
            pool_counter += 1
        try:
            detail, search_context = await run_detail_agent(
                node=node,
                topic=proposal.topic,
                language=proposal.language,
                tavily=self.tavily,
                model_override=model_override,
            )
        except Exception:
            ...
```

Note: `pool_counter` doesn't need to be thread-safe — asyncio is single-threaded. The semaphore serializes access to the counter within the concurrency limit, and even if two tasks read the counter "simultaneously" (they can't in asyncio, but even in theory), getting the same model is harmless (it's load balancing, not uniqueness).

Pool is empty by default → `model_override` stays `None` → detail_agent uses its default model. Backward compatible.

### Change 2: Pipeline Checkpoint

#### `backend/app/orchestrator/orchestrator.py`

Add `import copy` at top.

After Phase 2 TaskGroup completes (line 676), create snapshot:

```python
async with asyncio.TaskGroup() as tg:
    for node in nodes:
        tg.create_task(_enrich_node(node))

# Checkpoint: snapshot Phase 2 results
phase2_snapshot = copy.deepcopy(nodes)
```

Wrap Phase 3 entirely in try/except:

```python
# --- Phase 3: Gap Analysis ---
await session.push(SSEEventType.PROGRESS, {...})

gap_connections: list = []
try:
    # Step 3a: Hallucination filter
    nodes = await self._filter_hallucinations(nodes, detail_contexts)

    # Step 3b: Gap analysis + connections
    gap_result = await self._run_gap_analysis(nodes, proposal)
    gap_connections = gap_result.connections

    # Step 3c: Integrate gap nodes + push updated skeleton
    new_nodes: list[dict] = []
    if gap_result.gap_nodes:
        max_id = max(int(n["id"].split("_")[1]) for n in nodes)
        next_id = max_id + 1
        for gap_node in gap_result.gap_nodes:
            node_dict = {
                "id": f"ms_{next_id:03d}",
                **gap_node.model_dump(),
                "status": "skeleton",
                "is_gap_node": True,
            }
            next_id += 1
            new_nodes.append(node_dict)
        nodes.extend(new_nodes)
        nodes.sort(key=lambda n: n["date"])

    # Always push updated skeleton
    await session.push(SSEEventType.SKELETON, {"nodes": nodes})

    # Enrich gap nodes
    if new_nodes:
        async with asyncio.TaskGroup() as tg:
            for node in new_nodes:
                tg.create_task(_enrich_node(node))

    total = len(nodes)
except Exception:
    logger.warning("Phase 3 failed, falling back to Phase 2 snapshot")
    nodes = phase2_snapshot
    total = len(nodes)
    # Re-push snapshot skeleton so frontend has consistent state
    await session.push(SSEEventType.SKELETON, {"nodes": nodes})
```

Phase 4 (Synthesis) is unchanged — it already has its own try/except. `gap_connections` is now initialized before the try block, so it's always defined when Phase 4 references it.

Current Phase 4 behavior on failure: `synthesis_data` stays `None`, no SYNTHESIS event pushed, pipeline continues to COMPLETE + DB save. This is correct — frontend handles `synthesisData === null`.

### Change 3: DB Cache Topic Normalize

#### `backend/app/utils/__init__.py` (new, empty)

Empty `__init__.py` to make `utils` a package.

#### `backend/app/utils/topic.py` (new)

```python
import re
import unicodedata

_ALIASES: dict[str, str] = {
    "ww2": "world war ii",
    "wwii": "world war ii",
    "world war 2": "world war ii",
    "ww1": "world war i",
    "wwi": "world war i",
    "world war 1": "world war i",
    "二战": "第二次世界大战",
    "一战": "第一次世界大战",
}

def normalize_topic(topic: str) -> str:
    t = topic.strip().lower()
    t = unicodedata.normalize("NFKC", t)
    t = re.sub(r"\s+", " ", t)
    if t in _ALIASES:
        t = _ALIASES[t]
    return t
```

Note on alias direction: aliases only map within the same language (English→English, Chinese→Chinese). No cross-language mapping — "人工智能" and "AI" produce different-language timelines and must not share cache. v1 is conservative; semantic/cross-language cache is future work.

#### `backend/app/db/models.py`

Add `topic_normalized` column to `ResearchRow`:

```python
topic_normalized: Mapped[str] = mapped_column(String(512), index=True, default="")
```

Remove `unique=True` from `topic` column (keep `index=True` for display lookups). Add `unique=True` to `topic_normalized` instead, so upsert-by-normalized prevents duplicate entries.

Wait — this changes the semantics. Currently exact topic is unique. With normalized unique, "iPhone" and "iphone" can't coexist as separate rows. This is exactly what we want for cache: one entry per normalized topic.

```python
topic: Mapped[str] = mapped_column(Text, index=True)  # removed unique=True
topic_normalized: Mapped[str] = mapped_column(String(512), unique=True, index=True, default="")
```

#### `backend/app/db/repository.py`

Update `get_research_by_topic`:

```python
from app.utils.topic import normalize_topic

async def get_research_by_topic(session: AsyncSession, topic: str) -> ResearchRow | None:
    normalized = normalize_topic(topic)
    stmt = select(ResearchRow).where(ResearchRow.topic_normalized == normalized)
    result = await session.execute(stmt)
    return result.scalar_one_or_none()
```

Update `save_research` — the existing call `get_research_by_topic(session, proposal.topic)` now does normalized lookup automatically. Need to also set `topic_normalized` on new rows:

```python
research = ResearchRow(
    topic=proposal.topic,
    topic_normalized=normalize_topic(proposal.topic),
    ...
)
```

And on update, refresh `topic_normalized` in case the normalization logic changed:
```python
if existing:
    existing.topic_normalized = normalize_topic(proposal.topic)
    ...
```

#### Alembic Migration

New migration file. Steps:
1. Add `topic_normalized` column (String(512), nullable, default "")
2. Backfill: `UPDATE researches SET topic_normalized = LOWER(TRIM(topic))`
3. Make column non-nullable (ALTER COLUMN SET NOT NULL)
4. Drop unique index on `topic`
5. Create unique index on `topic_normalized`

```python
def upgrade() -> None:
    op.add_column("researches", sa.Column("topic_normalized", sa.String(512), nullable=True, server_default=""))
    op.execute("UPDATE researches SET topic_normalized = LOWER(TRIM(topic))")
    # Deduplicate: if multiple rows share the same normalized topic, keep only the newest
    op.execute("""
        DELETE FROM researches
        WHERE id NOT IN (
            SELECT DISTINCT ON (topic_normalized) id
            FROM researches
            ORDER BY topic_normalized, created_at DESC
        )
    """)
    op.alter_column("researches", "topic_normalized", nullable=False)
    op.drop_index("ix_researches_topic", table_name="researches")
    op.create_index("ix_researches_topic_normalized", "researches", ["topic_normalized"], unique=True)
    # Keep a non-unique index on topic for display purposes
    op.create_index("ix_researches_topic", "researches", ["topic"])

def downgrade() -> None:
    op.drop_index("ix_researches_topic", table_name="researches")
    op.drop_index("ix_researches_topic_normalized", table_name="researches")
    op.create_index("ix_researches_topic", "researches", ["topic"], unique=True)
    op.drop_column("researches", "topic_normalized")
```

The backfill uses `LOWER(TRIM(topic))` — a simplified version of `normalize_topic`. Before creating the unique index, duplicate normalized values are deduplicated (keeping the most recent row). Full normalization (NFKC, alias mapping) happens in Python on new writes.

---

## File Change Summary

| File | Action | Description |
|------|--------|-------------|
| `backend/app/config.py` | Edit | Add `detail_model_pool` field |
| `backend/app/agents/detail.py` | Edit | Add `model_override` param to `run_detail_agent` |
| `backend/app/orchestrator/orchestrator.py` | Edit | Pool parsing, round-robin in `_enrich_node`, Phase 2 checkpoint, Phase 3 try/except |
| `backend/app/utils/__init__.py` | New | Empty package init |
| `backend/app/utils/topic.py` | New | `normalize_topic()` function |
| `backend/app/db/models.py` | Edit | Add `topic_normalized` column, adjust `topic` uniqueness |
| `backend/app/db/repository.py` | Edit | Use normalized lookup in `get_research_by_topic` and `save_research` |
| `alembic/versions/xxx_add_topic_normalized.py` | New | Migration for `topic_normalized` column |

**Not changed:** Frontend, SSE events, session.py, main.py, other agents, llm.py, replay.py.

---

## Execution Order

1. `config.py` — add `detail_model_pool`
2. `agents/detail.py` — add `model_override` param
3. `orchestrator.py` — pool parsing + round-robin + checkpoint + Phase 3 try/except
4. `utils/__init__.py` + `utils/topic.py` — normalize function
5. `db/models.py` — add `topic_normalized` column
6. `db/repository.py` — use normalized lookup
7. Alembic migration — generate + adjust
8. `ruff check && ruff format && pnpm build`

---

## Todo List

- [x] 1. Add `detail_model_pool` to config.py
- [x] 2. Add `model_override` param to `run_detail_agent` in detail.py
- [x] 3. Add pool parsing + round-robin to orchestrator.py `_enrich_node`
- [x] 4. Add Phase 2 checkpoint + Phase 3 try/except in orchestrator.py
- [x] 5. Create `utils/topic.py` with `normalize_topic()`
- [x] 6. Add `topic_normalized` column to ResearchRow in models.py
- [x] 7. Update `get_research_by_topic` and `save_research` in repository.py
- [x] 8. Create Alembic migration for `topic_normalized`
- [x] 9. Run `ruff check && ruff format && pnpm build`
