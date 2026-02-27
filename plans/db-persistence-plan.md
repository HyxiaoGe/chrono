# 数据库 + 结果持久化 — 实施计划

## 背景

Chrono 当前无持久化，结果存在内存 SessionManager 中，刷新即丢。同一 topic 每次都要重跑完整 pipeline（$0.3-$2）。本次添加 PostgreSQL 持久化：pipeline 完成自动存库，相同 topic 再次查询时从 DB 回放 SSE 事件（秒级），前端零改动。

## 技术选型

| 组件 | 选择 | 理由 |
|------|------|------|
| ORM | SQLAlchemy 2.x (async) | 与 FastAPI/asyncio 栈契合，Mapped[] 类型标注完整 |
| Driver | asyncpg | 原生异步 PostgreSQL 驱动，性能最优 |
| Migrations | Alembic (async template) | SQLAlchemy 标配，支持 autogenerate |

## 表结构

### `researches` 表

```sql
CREATE TABLE researches (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic            TEXT NOT NULL,
    topic_type       VARCHAR(32) NOT NULL,
    language         VARCHAR(16) NOT NULL,
    complexity_level VARCHAR(16) NOT NULL,
    proposal         JSONB NOT NULL,
    synthesis        JSONB,            -- nullable: synthesis 可能失败
    total_nodes      INTEGER NOT NULL DEFAULT 0,
    source_count     INTEGER NOT NULL DEFAULT 0,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX ix_researches_topic ON researches (topic);
```

- `topic` 加 UNIQUE 索引，用于精确匹配缓存查找
- `topic_type`/`language`/`complexity_level` 从 proposal 中冗余提取，便于后续筛选/统计
- `proposal` 存完整的 `ResearchProposal.model_dump()` JSONB
- `synthesis` 存完整的 synthesis dict（含 connections），nullable 因为 synthesizer 可能失败

### `timeline_nodes` 表

```sql
CREATE TABLE timeline_nodes (
    id              SERIAL PRIMARY KEY,
    research_id     UUID NOT NULL REFERENCES researches(id) ON DELETE CASCADE,
    node_id         VARCHAR(16) NOT NULL,     -- "ms_001" 等
    date            VARCHAR(32) NOT NULL,
    title           TEXT NOT NULL,
    subtitle        TEXT NOT NULL DEFAULT '',
    significance    VARCHAR(16) NOT NULL,
    description     TEXT NOT NULL,
    details         JSONB,                    -- nullable: skeleton 阶段无 details
    sources         JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_gap_node     BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (research_id, node_id)
);

CREATE INDEX ix_timeline_nodes_research_id ON timeline_nodes (research_id);
```

- `node_id` 是 domain key（`"ms_001"`），与 `research_id` 组成复合唯一约束
- `sort_order` 保持最终排序顺序，回放时按此排序
- `is_gap_node` 标记 Gap Analysis 补充的节点
- ON DELETE CASCADE：删 research 时级联删除所有节点

## 核心流程

### 写入（pipeline 完成后）

```
Orchestrator.execute_research()
    ├─ Phase 1-4 正常执行
    ├─ push(COMPLETE, ...)
    ├─ session.status = COMPLETED
    └─ _save_to_db(proposal, nodes, synthesis_data, total_nodes, source_count)
        ├─ 已有相同 topic → UPDATE research + 删旧 nodes + INSERT 新 nodes
        └─ 无记录 → INSERT research + INSERT nodes
```

save 失败只 log warning，不影响用户体验（用户已收到 COMPLETE 事件）。

### 读取（缓存命中）

```
POST /api/research { topic: "iPhone" }
    ├─ 查 DB: SELECT * FROM researches WHERE topic = 'iPhone'
    ├─ HIT: 从 DB 构建 proposal → 返回 session_id + proposal
    │        session.cached_research_id = research.id
    └─ MISS: 正常调 orchestrator.create_proposal()

GET /api/research/{session_id}/stream
    ├─ session.cached_research_id 不为 None → replay_research(session, research_id)
    └─ 为 None → 正常 orchestrator.execute_research(session)
```

### SSE 回放（replay_research）

从 DB 读取数据，按正常 pipeline 的事件顺序推送，前端不感知差异：

1. `PROGRESS` (skeleton)
2. `SKELETON` (所有节点)
3. `PROGRESS` (detail)
4. `NODE_DETAIL` × N
5. `PROGRESS` (analysis)
6. `SKELETON` (同一份最终数据)
7. `PROGRESS` (synthesis)
8. `SYNTHESIS`
9. `COMPLETE`

## DB 可选设计

`DATABASE_URL` 为空时所有 DB 相关代码路径为 no-op，应用行为与当前完全一致。

```python
# app/db/database.py
engine = None
async_session_factory = None

if settings.database_url:
    engine = create_async_engine(settings.database_url, pool_size=5, max_overflow=10)
    async_session_factory = async_sessionmaker(engine, expire_on_commit=False)
```

## 文件改动清单

### 新建文件（6 个）

| 文件 | 说明 |
|------|------|
| `app/db/__init__.py` | 空 |
| `app/db/database.py` | async engine + session factory，受 `database_url` 控制 |
| `app/db/models.py` | `ResearchRow` + `TimelineNodeRow` ORM 模型 |
| `app/db/repository.py` | `get_research_by_topic()`, `get_nodes_for_research()`, `save_research()` |
| `app/db/replay.py` | `replay_research()` — 从 DB 回放 SSE 事件 |
| `alembic/` | Alembic 初始化（`alembic init -t async alembic`），修改 `env.py` 接入 async engine |

### 修改文件（5 个）

| 文件 | 改动 |
|------|------|
| `pyproject.toml` | 新增 `sqlalchemy[asyncio]`, `asyncpg`, `alembic` |
| `app/config.py` | 新增 `database_url: str = ""` |
| `app/models/session.py` | `ResearchSession.__init__` 新增 `cached_research_id: UUID \| None = None` |
| `app/orchestrator/orchestrator.py` | ① 提升 `synthesis_data` 变量作用域；② gap node dict 添加 `"is_gap_node": True`；③ COMPLETE 后调 `_save_to_db()` |
| `app/main.py` | ① 添加 lifespan（engine.dispose）；② `create_research` 添加缓存查询；③ `stream_research` 添加回放分支 |
| `.env.example` | 新增 `DATABASE_URL=` |

### 不动的文件

- 所有 Agent 文件（milestone/detail/gap_analysis/synthesizer）
- Prompt 不动
- 前端 SSE 处理逻辑不动
- `services/llm.py`, `services/tavily.py` 不动

## Orchestrator 改动细节

### ① 提升 synthesis_data 作用域

```python
# Phase 4 之前初始化
synthesis_data: dict | None = None

# 原有 try 块内赋值
try:
    synthesis = await run_synthesizer_agent(...)
    synthesis_data = synthesis.model_dump()
    synthesis_data["source_count"] = source_count
    synthesis_data["connections"] = [c.model_dump() for c in gap_connections]
    await session.push(SSEEventType.SYNTHESIS, synthesis_data)
except Exception:
    logger.warning("Synthesizer failed, skipping synthesis")
```

### ② Gap node 标记

```python
node_dict = {
    "id": f"ms_{next_id:03d}",
    **gap_node.model_dump(),
    "status": "skeleton",
    "is_gap_node": True,  # 新增
}
```

### ③ COMPLETE 后存库

```python
session.status = SessionStatus.COMPLETED

# Persist to DB
try:
    await self._save_to_db(
        proposal=proposal, nodes=nodes,
        synthesis_data=synthesis_data,
        total_nodes=total, source_count=source_count,
    )
except Exception:
    logger.warning("Failed to persist research to DB, skipping")
```

`_save_to_db` 方法直接使用 `async_session_factory`，不依赖 FastAPI Depends。

## main.py 改动细节

```python
@app.post("/api/research", ...)
async def create_research(request: ResearchRequest):
    session_id = str(uuid.uuid4())

    # Cache check
    if async_session_factory is not None:
        async with async_session_factory() as db:
            cached = await get_research_by_topic(db, request.topic)
        if cached:
            proposal = ResearchProposal.model_validate(cached.proposal)
            sess = session_manager.create(session_id, proposal)
            sess.cached_research_id = cached.id
            return ResearchProposalResponse(session_id=session_id, proposal=proposal)

    # Cache miss: normal flow
    proposal = await orchestrator.create_proposal(request)
    session_manager.create(session_id, proposal)
    return ResearchProposalResponse(session_id=session_id, proposal=proposal)


@app.get("/api/research/{session_id}/stream")
async def stream_research(session_id: str, request: Request):
    session = session_manager.get(session_id)
    # ... existing checks ...

    if session.cached_research_id is not None:
        session.task = asyncio.create_task(
            replay_research(session, session.cached_research_id)
        )
    else:
        session.task = asyncio.create_task(
            orchestrator.execute_research(session)
        )

    return EventSourceResponse(session.event_generator(request), ...)
```

## 边界情况

| 场景 | 处理 |
|------|------|
| DB 未配置（`DATABASE_URL` 空） | 所有 DB 路径为 no-op，行为与当前一致 |
| DB 不可达 | cache check 失败 → catch exception → 走正常 pipeline；save 失败 → log warning |
| Synthesis 失败 | `synthesis_data = None`，仍然存库；回放时跳过 SYNTHESIS 事件 |
| 同 topic 并发请求 | 两个都跑完，第二个 save 覆盖第一个（UPDATE），数据一致 |
| 大小写不同（"iPhone" vs "iphone"） | v1 精确匹配，视为不同 topic |

## Todo List

### Phase A: 依赖 + 基础设施
- [ ] `pyproject.toml` 新增 `sqlalchemy[asyncio]`, `asyncpg`, `alembic`，`uv sync`
- [ ] `config.py` 新增 `database_url: str = ""`
- [ ] 创建 `app/db/__init__.py`
- [ ] 创建 `app/db/database.py`（engine + session factory）
- [ ] 创建 `app/db/models.py`（ORM 模型）

### Phase B: Alembic + 迁移
- [ ] `alembic init -t async alembic`
- [ ] 修改 `alembic/env.py` 接入 async engine + Base.metadata
- [ ] `alembic revision --autogenerate` 生成初始迁移
- [ ] `alembic upgrade head` 建表

### Phase C: 写入逻辑
- [ ] 创建 `app/db/repository.py`（save_research, get_research_by_topic, get_nodes_for_research）
- [ ] `orchestrator.py`：提升 synthesis_data 作用域 + gap node 标记 + _save_to_db
- [ ] `session.py`：新增 cached_research_id 字段

### Phase D: 读取 + 回放
- [ ] 创建 `app/db/replay.py`（replay_research）
- [ ] `main.py`：lifespan + create_research 缓存查询 + stream_research 回放分支
- [ ] `.env.example` 新增 DATABASE_URL

### Phase E: 验证
- [ ] `ruff check . && ruff format .`
- [ ] `uv run fastapi dev` 启动无报错
- [ ] 首次跑 "iPhone" → pipeline 正常执行 → DB 有记录
- [ ] 再次输入 "iPhone" → 秒级返回（SSE 回放）
- [ ] 输入 "iphone"（小写）→ 走 pipeline（精确匹配不命中）
- [ ] DATABASE_URL 为空时 → 行为与当前完全一致
