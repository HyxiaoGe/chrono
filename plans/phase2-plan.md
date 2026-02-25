# Phase 2 Plan — SSE + Milestone Agent + Tavily

## 目标 ✅

```
1. POST /api/research { topic: "iPhone" } → 返回 proposal + session_id（已完成）
2. GET /api/research/{session_id}/stream → 开启 SSE 连接 ✅
3. Orchestrator 调度 Milestone Agent 构建时间线骨架 ✅
4. SSE 推送事件序列：progress → skeleton → complete ✅
```

---

## 1. 文件结构（新增/修改）

```
backend/app/
├── main.py                    # [修改] 新增 GET /api/research/{session_id}/stream
├── models/
│   ├── research.py            # [修改] 新增 SkeletonNode、SSE 事件模型
│   └── session.py             # [新增] ResearchSession + SessionManager
├── orchestrator/
│   └── orchestrator.py        # [修改] 新增 execute_research 方法
├── agents/
│   ├── __init__.py            # [新增]
│   ├── deps.py                # [新增] AgentDeps dataclass
│   └── milestone.py           # [新增] Milestone Agent 定义
└── services/
    └── tavily.py              # [新增] TavilyService 封装
```

---

## 2. 各文件设计

### 2.1 services/tavily.py — Tavily 封装

```python
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
```

全局单例，在 `main.py` 启动时创建。薄封装——只暴露我们用到的参数，后续可加缓存/限流。

### 2.2 agents/deps.py — Agent 依赖

```python
from dataclasses import dataclass

from app.services.tavily import TavilyService


@dataclass
class AgentDeps:
    tavily: TavilyService
    topic: str
    language: str
```

所有子 Agent 共享同一个 deps 类型。`topic` 和 `language` 在运行时传入，让 tool 和 system prompt 能感知上下文。

### 2.3 models/research.py — 新增模型

在现有文件中追加：

**骨架节点（Milestone Agent 的输出）：**

```python
class Significance(StrEnum):
    REVOLUTIONARY = "revolutionary"
    HIGH = "high"
    MEDIUM = "medium"

class SkeletonNode(BaseModel):
    date: str                         # ISO 格式，如 "2007-01-09"
    title: str
    subtitle: str = ""
    significance: Significance
    description: str                  # 2-3 句概述
    sources: list[str] = Field(default_factory=list)

class MilestoneResult(BaseModel):
    nodes: list[SkeletonNode]
```

注意：`id` 和 `status` 不让 LLM 生成——`id` 由 Orchestrator 分配（uuid），`status` 固定为 `"skeleton"`。

**SSE 事件模型：**

```python
from enum import StrEnum
from typing import Any

class SSEEventType(StrEnum):
    PROGRESS = "progress"
    SKELETON = "skeleton"
    COMPLETE = "complete"
    ERROR = "error"
```

事件的 data payload 不需要额外 Pydantic model——直接用 dict 构造，在 session 层 json.dumps。定义 type enum 即可。

### 2.4 models/session.py — Session 管理

```python
import asyncio
import json
from enum import StrEnum
from typing import Any

from fastapi import Request
from sse_starlette import ServerSentEvent

from app.models.research import ResearchProposal, SSEEventType


class SessionStatus(StrEnum):
    PROPOSAL_READY = "proposal_ready"
    EXECUTING = "executing"
    COMPLETED = "completed"
    FAILED = "failed"


class ResearchSession:
    def __init__(self, session_id: str, proposal: ResearchProposal) -> None:
        self.session_id = session_id
        self.proposal = proposal
        self.status = SessionStatus.PROPOSAL_READY
        self.queue: asyncio.Queue[tuple[SSEEventType, dict[str, Any]] | None] = asyncio.Queue()
        self._task: asyncio.Task | None = None

    async def push(self, event_type: SSEEventType, data: dict[str, Any]) -> None:
        if self.status not in (SessionStatus.COMPLETED, SessionStatus.FAILED):
            await self.queue.put((event_type, data))

    async def close(self) -> None:
        await self.queue.put(None)

    async def event_generator(self, request: Request):
        try:
            while True:
                if await request.is_disconnected():
                    break
                try:
                    item = await asyncio.wait_for(self.queue.get(), timeout=1.0)
                except asyncio.TimeoutError:
                    continue
                if item is None:
                    break
                event_type, data = item
                yield ServerSentEvent(
                    data=json.dumps(data, ensure_ascii=False),
                    event=event_type.value,
                )
        except asyncio.CancelledError:
            raise


class SessionManager:
    def __init__(self) -> None:
        self._sessions: dict[str, ResearchSession] = {}

    def create(self, session_id: str, proposal: ResearchProposal) -> ResearchSession:
        session = ResearchSession(session_id, proposal)
        self._sessions[session_id] = session
        return session

    def get(self, session_id: str) -> ResearchSession | None:
        return self._sessions.get(session_id)
```

Queue 的 item 类型是 `tuple[SSEEventType, dict] | None`，None 作为 sentinel 终止 generator。

### 2.5 agents/milestone.py — Milestone Agent

```python
from pydantic_ai import Agent, RunContext, UsageLimits
from pydantic_ai.models.openrouter import OpenRouterModel

from app.agents.deps import AgentDeps
from app.config import settings
from app.models.research import MilestoneResult
from app.services.llm import provider

milestone_agent = Agent(
    OpenRouterModel(settings.milestone_model, provider=provider),
    deps_type=AgentDeps,
    output_type=MilestoneResult,
    instructions="""\
你是 Chrono 时间线调研系统的里程碑研究专家。你的任务是为给定的 topic 构建一份时间线骨架。

## 工作流程（严格按顺序执行）

### Step 1: 凭自身知识列出里程碑
先不要搜索。基于你的知识储备，列出这个 topic 的关键里程碑事件。
包含：大致日期、事件名称、重要程度。

### Step 2: 验证性搜索
用 search 工具搜索 1-2 次，验证你列出的日期是否准确，是否遗漏了重要事件。
搜索词示例："{topic} major milestones timeline", "{topic} history key events"

### Step 3: 搜索近期信息
用 search 工具搜索 1-2 次，专门查找最近 1-2 年的最新动态（你的知识可能没有覆盖）。
搜索词示例："{topic} latest news 2025 2026", "{topic} recent developments"

### Step 4: 定稿输出
- 合并所有信息，去除重复
- 按时间正序排列
- 评估每个节点的重要度：revolutionary（开创性）、high（重要）、medium（一般）
- date 使用 ISO 格式（YYYY-MM-DD），如果只知道年份就用 YYYY-01-01，只知道年月就用 YYYY-MM-01
- description 写 2-3 句话的概述
- sources 填入搜索到的相关 URL

## 约束
- 搜索次数控制在 4-6 次，不要过度搜索
- revolutionary 级别的节点应该很少（通常 1-3 个），大部分是 high 或 medium
- 节点数量参考：light topic 15-25 个，medium topic 25-45 个
- 使用输入 topic 的语言输出所有文本字段""",
    retries=2,
)


@milestone_agent.tool
async def search(ctx: RunContext[AgentDeps], query: str) -> str:
    """搜索互联网获取最新信息。返回搜索结果的摘要和链接。"""
    response = await ctx.deps.tavily.search(query, max_results=5)
    parts = []
    if answer := response.get("answer"):
        parts.append(f"Summary: {answer}\n")
    for r in response.get("results", []):
        content = r.get("content", "")[:300]
        parts.append(f"- [{r['title']}]({r['url']})\n  {content}")
    return "\n".join(parts) if parts else "No results found."


async def run_milestone_agent(topic: str, language: str, tavily: TavilyService) -> MilestoneResult:
    deps = AgentDeps(tavily=tavily, topic=topic, language=language)
    result = await milestone_agent.run(
        f"为以下主题构建时间线骨架：{topic}",
        deps=deps,
        usage_limits=UsageLimits(request_limit=15),
    )
    return result.output
```

`run_milestone_agent` 是 Orchestrator 调用的入口——纯函数，Orchestrator 不直接接触 agent 实例。

需要在文件顶部 import TavilyService：

```python
from app.services.tavily import TavilyService
```

### 2.6 orchestrator/orchestrator.py — 扩展

在现有 `Orchestrator` class 上新增 `execute_research` 方法：

```python
import uuid

from app.agents.milestone import run_milestone_agent
from app.models.research import SSEEventType
from app.models.session import ResearchSession
from app.services.tavily import TavilyService


class Orchestrator:
    def __init__(self, tavily: TavilyService) -> None:
        self.tavily = tavily

    async def create_proposal(self, request: ResearchRequest) -> ResearchProposal:
        # ... 现有逻辑不变 ...

    async def execute_research(self, session: ResearchSession) -> None:
        proposal = session.proposal
        try:
            session.status = SessionStatus.EXECUTING

            # Phase 1: 骨架构建
            await session.push(SSEEventType.PROGRESS, {
                "phase": "skeleton",
                "message": "正在构建时间线骨架...",
                "percent": 0,
            })

            milestone_result = await run_milestone_agent(
                topic=proposal.topic,
                language=proposal.language,
                tavily=self.tavily,
            )

            # 给每个节点分配 id 和 status
            nodes = []
            for node in milestone_result.nodes:
                nodes.append({
                    "id": str(uuid.uuid4())[:8],
                    **node.model_dump(),
                    "status": "skeleton",
                })

            await session.push(SSEEventType.SKELETON, {"nodes": nodes})

            await session.push(SSEEventType.COMPLETE, {
                "total_nodes": len(nodes),
            })
            session.status = SessionStatus.COMPLETED

        except Exception:
            logger.exception("Research execution failed")
            await session.push(SSEEventType.ERROR, {
                "error": "research_failed",
                "message": "Research execution failed. Please try again.",
            })
            session.status = SessionStatus.FAILED
        finally:
            await session.close()
```

关键改动：
- **`__init__` 接收 `TavilyService`**：Orchestrator 持有 Tavily 引用，传给子 Agent
- **`execute_research`**：纯 asyncio 方法，调用 `run_milestone_agent`，把结果通过 session.push 发出
- **节点 id 由 Orchestrator 分配**：不让 LLM 生成 id，用短 uuid

### 2.7 main.py — 新增 SSE 端点

```python
import asyncio

from fastapi import FastAPI, HTTPException, Request
from sse_starlette import EventSourceResponse

from app.models.session import SessionManager, SessionStatus
from app.services.tavily import TavilyService


tavily_service = TavilyService()
session_manager = SessionManager()
orchestrator = Orchestrator(tavily=tavily_service)


@app.post("/api/research", ...)
async def create_research(request: ResearchRequest) -> ResearchProposalResponse:
    session_id = str(uuid.uuid4())
    try:
        proposal = await orchestrator.create_proposal(request)
    except Exception as exc:
        # ... 现有错误处理 ...
    session_manager.create(session_id, proposal)
    return ResearchProposalResponse(session_id=session_id, proposal=proposal)


@app.get("/api/research/{session_id}/stream")
async def stream_research(session_id: str, request: Request):
    session = session_manager.get(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.status != SessionStatus.PROPOSAL_READY:
        raise HTTPException(status_code=409, detail="Session already started or completed")

    # 启动 Orchestrator 后台任务
    session._task = asyncio.create_task(
        orchestrator.execute_research(session)
    )

    return EventSourceResponse(
        session.event_generator(request),
        ping=15,
        send_timeout=30,
        headers={"X-Accel-Buffering": "no"},
    )
```

`POST` 创建 session 并存入 manager。`GET stream` 取出 session，启动后台执行，返回 SSE 流。

---

## 3. 数据流

```
Client
  │
  │ POST /api/research { "topic": "iPhone" }
  ▼
FastAPI → Orchestrator.create_proposal() → OpenRouter LLM
  │
  │ 200 { session_id, proposal }
  ▼
Client
  │
  │ GET /api/research/{session_id}/stream
  ▼
FastAPI → asyncio.create_task(orchestrator.execute_research(session))
  │
  │ EventSourceResponse(session.event_generator)
  ▼

  ┌─────────────────────────────┐     ┌──────────────────────────────┐
  │   Orchestrator (background) │     │  SSE endpoint (generator)    │
  │                             │     │                              │
  │  push(PROGRESS, {...})      │────►│  yield ServerSentEvent(...)  │──► Client
  │                             │     │                              │
  │  milestone_agent.run(...)   │     │  await queue.get()           │
  │    └─ LLM ↔ search tool    │     │                              │
  │                             │     │                              │
  │  push(SKELETON, {nodes})    │────►│  yield ServerSentEvent(...)  │──► Client
  │                             │     │                              │
  │  push(COMPLETE, {...})      │────►│  yield ServerSentEvent(...)  │──► Client
  │                             │     │                              │
  │  session.close() → None     │────►│  break                       │
  └─────────────────────────────┘     └──────────────────────────────┘
```

---

## 4. 预期 SSE 事件流

```
event: progress
data: {"phase":"skeleton","message":"正在构建时间线骨架...","percent":0}

event: skeleton
data: {"nodes":[{"id":"a1b2c3d4","date":"2007-01-09","title":"iPhone 发布","subtitle":"初代 iPhone","significance":"revolutionary","description":"Steve Jobs 在 Macworld 大会上发布了第一代 iPhone...","sources":["https://..."],"status":"skeleton"},{"id":"e5f6g7h8","date":"2008-07-11","title":"App Store 上线","subtitle":"iOS 应用商店","significance":"revolutionary","description":"...","sources":["https://..."],"status":"skeleton"},...]}

event: complete
data: {"total_nodes":20}
```

---

## 5. 验证方式

```bash
# 终端 1：启动服务
cd backend && uv run fastapi dev app/main.py --port 8001

# 终端 2：创建调研
curl -s -X POST http://localhost:8001/api/research \
  -H "Content-Type: application/json" \
  -d '{"topic": "iPhone"}' | python3 -m json.tool
# 记录返回的 session_id

# 终端 3：连接 SSE 流
curl -N http://localhost:8001/api/research/{session_id}/stream
```

成功标准：
1. ✅ SSE 流依次输出 progress → skeleton → complete 三个事件
2. ✅ skeleton 事件包含 15-25 个节点（实际 20 个）
3. ✅ 节点的 date 是 ISO 格式，significance 分布合理
4. ✅ sources 列表中有来自 Tavily 搜索的真实 URL
5. 客户端断连后不会导致服务器报错（未验证，低风险）
