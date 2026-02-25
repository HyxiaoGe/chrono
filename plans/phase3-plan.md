# Phase 3 Plan — Detail Agent 逐节点深度补充

## 目标 ✅

```
skeleton 之后，Detail Agent 逐节点补充详情 → 每完成一个节点推送 node_detail → 最后 complete ✅
完整事件流：progress("骨架构建") → skeleton → progress("深度补充") → node_detail × N → complete ✅
```

---

## 1. 文件结构（新增/修改）

```
backend/app/
├── models/
│   └── research.py            # [修改] 新增 NodeDetail，SSEEventType 增加 NODE_DETAIL
├── agents/
│   └── detail.py              # [新增] Detail Agent 定义
└── orchestrator/
    └── orchestrator.py        # [修改] execute_research 增加 Phase 2 编排逻辑
```

---

## 2. 各文件设计

### 2.1 models/research.py — 新增 NodeDetail

```python
class NodeDetail(BaseModel):
    key_features: list[str]       # 关键特性/要点（3-5 条）
    impact: str                   # 影响和意义
    key_people: list[str]         # 关键人物
    context: str                  # 背景和因果关系
    sources: list[str] = Field(default_factory=list)
```

SSEEventType 新增：

```python
class SSEEventType(StrEnum):
    PROGRESS = "progress"
    SKELETON = "skeleton"
    NODE_DETAIL = "node_detail"   # 新增
    COMPLETE = "complete"
    ERROR = "error"
```

### 2.2 agents/detail.py — Detail Agent

```python
from pydantic_ai import Agent, RunContext, UsageLimits
from pydantic_ai.models.openrouter import OpenRouterModel

from app.agents.deps import AgentDeps
from app.config import settings
from app.models.research import NodeDetail
from app.services.llm import provider
from app.services.tavily import TavilyService

detail_agent = Agent(
    OpenRouterModel(settings.detail_model, provider=provider),
    deps_type=AgentDeps,
    output_type=NodeDetail,
    instructions="""\
你是 Chrono 时间线调研系统的深度研究专家。你的任务是为时间线上的一个里程碑节点补充详细信息。

## 你会收到的信息

一个里程碑节点的基本信息：日期、标题、概述、重要程度。

## 工作流程（严格按顺序执行）

### Step 1: 基于自身知识生成初稿
先不要搜索。根据你的知识储备，填充以下字段：
- key_features: 3-5 条关键特性或要点（每条一句话）
- impact: 这个事件的影响和意义（2-3 句话）
- key_people: 关键人物列表（人名 + 一句话说明角色）
- context: 背景和因果关系——这个事件为什么会发生？之前发生了什么导致了它？（2-3 句话）

### Step 2: 搜索补充
用 search 工具搜索 1-2 次，补充你不确定的事实数据（具体数字、精确日期、人物全名等）。
搜索词应该具体到这个事件本身，不要搜索整个 topic 的宽泛信息。

### Step 3: 定稿
合并搜索到的新信息到各字段中。如果搜索结果与你的知识有冲突，以搜索结果为准。
sources 填入搜索到的相关 URL。

## 约束
- 搜索次数严格控制在 1-2 次，不要过度搜索
- key_features 必须是具体的事实，不要写空泛的评价
- key_people 如果确实没有特定关键人物（比如某个技术标准发布），可以为空列表
- 使用输入指定的语言输出所有文本字段""",
    retries=2,
)


@detail_agent.tool
async def search(ctx: RunContext[AgentDeps], query: str) -> str:
    """搜索互联网获取最新信息。返回搜索结果的摘要和链接。"""
    response = await ctx.deps.tavily.search(query, max_results=5)
    parts: list[str] = []
    if answer := response.get("answer"):
        parts.append(f"Summary: {answer}\n")
    for r in response.get("results", []):
        content = r.get("content", "")[:300]
        parts.append(f"- [{r['title']}]({r['url']})\n  {content}")
    return "\n".join(parts) if parts else "No results found."


async def run_detail_agent(
    node: dict,
    topic: str,
    language: str,
    tavily: TavilyService,
) -> NodeDetail:
    deps = AgentDeps(tavily=tavily, topic=topic, language=language)
    prompt = (
        f"请为以下里程碑节点补充详细信息：\n\n"
        f"日期：{node['date']}\n"
        f"标题：{node['title']}\n"
        f"概述：{node['description']}\n"
        f"重要程度：{node['significance']}"
    )
    result = await detail_agent.run(
        prompt,
        deps=deps,
        usage_limits=UsageLimits(request_limit=8),
    )
    return result.output
```

关键设计决策：

- **`run_detail_agent` 接收 node dict**：直接使用 skeleton 阶段生成的节点 dict（包含 id, date, title, description, significance）
- **prompt 包含节点具体信息**：不在 instructions 里用占位符，而是在 user prompt 里传入具体节点数据
- **`usage_limits=UsageLimits(request_limit=8)`**：每个节点最多 8 次 LLM 往返（knowledge → search × 2 → finalize，留余量）
- **search tool 复制自 milestone.py**：当前两个 agent 的 search tool 代码相同，直接复制。后续如果加更多 agent 再抽取

### 2.3 orchestrator/orchestrator.py — 扩展 execute_research

```python
import asyncio
import logging

from app.agents.detail import run_detail_agent
from app.agents.milestone import run_milestone_agent

_PROGRESS_MESSAGES: dict[str, dict[str, str]] = {
    "skeleton": {
        "zh": "正在构建时间线骨架...",
        "en": "Building timeline skeleton...",
        "ja": "タイムラインの骨格を構築中...",
    },
    "detail": {
        "zh": "正在深度补充节点详情...",
        "en": "Enriching timeline details...",
        "ja": "タイムラインの詳細を補充中...",
    },
}

DETAIL_CONCURRENCY = 4

class Orchestrator:
    # ...

    async def execute_research(self, session: ResearchSession) -> None:
        proposal = session.proposal
        try:
            session.status = SessionStatus.EXECUTING

            # --- Phase 1: Skeleton ---
            await session.push(SSEEventType.PROGRESS, {
                "phase": "skeleton",
                "message": _get_progress_message("skeleton", proposal.language),
                "percent": 0,
            })

            milestone_result = await run_milestone_agent(
                topic=proposal.topic,
                language=proposal.language,
                tavily=self.tavily,
            )

            nodes = []
            for i, node in enumerate(milestone_result.nodes, start=1):
                nodes.append({
                    "id": f"ms_{i:03d}",
                    **node.model_dump(),
                    "status": "skeleton",
                })

            await session.push(SSEEventType.SKELETON, {"nodes": nodes})

            # --- Phase 2: Detail ---
            await session.push(SSEEventType.PROGRESS, {
                "phase": "detail",
                "message": _get_progress_message("detail", proposal.language),
                "percent": 0,
            })

            sem = asyncio.Semaphore(DETAIL_CONCURRENCY)
            completed = 0
            total = len(nodes)

            async def _enrich_node(node: dict) -> None:
                nonlocal completed
                async with sem:
                    try:
                        detail = await run_detail_agent(
                            node=node,
                            topic=proposal.topic,
                            language=proposal.language,
                            tavily=self.tavily,
                        )
                    except Exception:
                        logger.warning("Detail agent failed for node %s", node["id"])
                        completed += 1
                        return
                completed += 1
                await session.push(SSEEventType.NODE_DETAIL, {
                    "node_id": node["id"],
                    "details": detail.model_dump(),
                })

            async with asyncio.TaskGroup() as tg:
                for node in nodes:
                    tg.create_task(_enrich_node(node))

            # --- Complete ---
            await session.push(SSEEventType.COMPLETE, {
                "total_nodes": total,
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

关键设计决策：

- **`DETAIL_CONCURRENCY = 4`**：模块级常量，控制并发度。不放在 Settings 里——这是实现细节不是用户配置
- **`TaskGroup` + `Semaphore`**：TaskGroup 管理子任务生命周期（client 断连时自动 cancel），Semaphore 限制并发
- **异常在 wrapper 内 catch**：单节点失败不影响其他节点。失败的节点保持 skeleton 状态，不推送 node_detail
- **`session.push` 在 `async with sem` 外面**：释放并发槽位后再推送，不阻塞其他节点
- **`nonlocal completed` 计数**：用于 complete 事件的统计。asyncio 是单线程的，`nonlocal` 不需要锁
- **不推送逐节点 progress**：node_detail 事件本身就隐含进度，前端可以自己算 received / total。避免 progress 事件过多

---

## 3. 数据流

```
Phase 1（已有）:
  Orchestrator → run_milestone_agent() → skeleton 事件

Phase 2（新增）:
  Orchestrator
    ├─ push(progress, "detail")
    ├─ TaskGroup + Semaphore(4)
    │   ├─ Task 1: run_detail_agent(ms_001) → push(node_detail, {ms_001, details})
    │   ├─ Task 2: run_detail_agent(ms_002) → push(node_detail, {ms_002, details})
    │   ├─ Task 3: run_detail_agent(ms_003) → push(node_detail, {ms_003, details})
    │   ├─ Task 4: run_detail_agent(ms_004) → push(node_detail, {ms_004, details})  ← 并发上限
    │   │   ... Task 1 完成，Task 5 开始 ...
    │   ├─ Task 5: run_detail_agent(ms_005) → push(node_detail, {ms_005, details})
    │   └─ ...
    └─ push(complete, {total_nodes: 20})
```

---

## 4. 预期 SSE 事件流

```
event: progress
data: {"phase":"skeleton","message":"正在构建时间线骨架...","percent":0}

event: skeleton
data: {"nodes":[{"id":"ms_001","date":"2007-01-09","title":"iPhone 发布",...,"status":"skeleton"},...]

event: progress
data: {"phase":"detail","message":"正在深度补充节点详情...","percent":0}

event: node_detail
data: {"node_id":"ms_003","details":{"key_features":["..."],"impact":"...","key_people":["..."],"context":"...","sources":["https://..."]}}

event: node_detail
data: {"node_id":"ms_001","details":{...}}

event: node_detail
data: {"node_id":"ms_002","details":{...}}

... (注意：node_detail 的顺序不固定，哪个先完成先推送)

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
1. ✅ 事件流完整：progress(skeleton) → skeleton → progress(detail) → node_detail × N → complete
2. ✅ node_detail 事件逐个到达（到达顺序 001→004→003→002→005→006，证明并发且先完成先推）
3. ✅ 每个 node_detail 的 details 包含 key_features, impact, key_people, context, sources
4. ✅ node_detail 的 node_id 对应 skeleton 中的节点 id
5. 未触发失败场景，但错误处理逻辑已就绪（try/except + logger.warning）
