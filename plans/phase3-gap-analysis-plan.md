# Phase 3: Gap Analysis & Hallucination Filter — Implementation Plan

## 概述

在 Phase 2（Detail 补充）和 Phase 4（Synthesis）之间插入 Phase 3，解决两个问题：
1. LLM 编造未来事件（如"GPT-5 多模态统一 2025"），没有过滤机制
2. 时间线是孤立节点列表，没有因果关系，没有空白检测

Phase 3 分两个子任务顺序执行：
- **3a: 编造过滤** — LLM 验证近期节点是否有搜索证据支撑，移除编造
- **3b: 补盲 + 因果关系** — LLM 分析完整时间线，补充缺失节点，建立因果链

## 涉及文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `backend/app/agents/detail.py` | 修改 | `run_detail_agent()` 额外返回 search context |
| `backend/app/orchestrator/orchestrator.py` | 修改 | 插入 Phase 3 逻辑，存储 detail search context |
| `backend/app/models/research.py` | 修改 | 新增 `TimelineConnection`、`GapAnalysisResult`、`HallucinationCheckResult`，`SynthesisResult` 新增 connections |
| `backend/app/config.py` | 修改 | 新增 `gap_analysis_model` 配置 |
| `frontend/src/types/index.ts` | 修改 | `SynthesisData` 新增 connections |
| `frontend/src/components/Timeline.tsx` | 暂不改 | connections 数据先存着，前端可视化后续做 |

不改的部分：
- Synthesizer Agent：保持不变
- Milestone Agent：保持不变
- Dedup 逻辑：保持不变
- SSE 协议：不新增事件类型（gap nodes 复用 skeleton + node_detail 事件）

## 详细设计

### 1. Detail Agent 返回 search context

#### 1.1 问题

编造过滤需要每个近期节点的搜索 context（用来判断搜索结果是否真的覆盖了该事件）。当前 `run_detail_agent()` 内部搜索后 context 就丢弃了。

#### 1.2 方案

`run_detail_agent()` 返回值从 `NodeDetail` 改为 `tuple[NodeDetail, str]`，第二个元素是 search context。

```python
async def run_detail_agent(
    node: dict,
    topic: str,
    language: str,
    tavily: TavilyService,
) -> tuple[NodeDetail, str]:
    query = f"{topic} {node['title']} {node['date'][:4]}"
    try:
        context, urls = await tavily.search_and_format(query)
    except Exception:
        logger.warning("Search failed for %s, proceeding without context", node["title"])
        context, urls = "No search results available.", []

    prompt = (...)
    result = await detail_agent.run(prompt, ...)
    output = result.output
    output.sources = urls
    return output, context
```

#### 1.3 Orchestrator 适配

`_enrich_node` 中解包 tuple，只对 date >= "2025" 的节点保存 context：

```python
# Orchestrator 新增实例变量
self._detail_contexts: dict[str, str] = {}  # {node_id: search_context}

async def _enrich_node(node: dict) -> None:
    nonlocal detail_completed
    async with sem:
        try:
            detail, search_context = await run_detail_agent(...)
        except Exception:
            ...
            return
    detail_completed += 1
    node["details"] = detail.model_dump()
    # 只存近期节点的 context，不浪费内存
    if node["date"] >= "2025":
        self._detail_contexts[node["id"]] = search_context
    await session.push(...)
```

`_detail_contexts` 作为实例变量存储，Phase 3 使用后清空。

### 2. 子任务 A：编造过滤（Hallucination Filter）

#### 2.1 模型定义

```python
# models/research.py
class HallucinationCheckResult(BaseModel):
    remove_ids: list[str]
    reasons: dict[str, str]  # {node_id: 移除原因}
```

#### 2.2 Agent 定义

定义在 `orchestrator.py` 内部（和 dedup agent 同级），用 DeepSeek V3（最便宜）。

```python
_hallucination_agent = Agent(
    OpenRouterModel(settings.milestone_model, provider=provider),
    output_type=HallucinationCheckResult,
    instructions="""\
You are a fact-checking specialist. You will receive a list of recent timeline events \
(from 2025 onward) along with their search reference materials.

Your job: determine which events have NO evidence of actually having occurred \
in the search references.

Rules:
- An event is VERIFIED if the search references contain reports of it actually happening
- An event is UNVERIFIED (should be removed) if:
  - The search references only contain predictions, forecasts, or speculation about it
  - The search references do not mention it at all
  - The search references describe it as a future plan, not a completed event
- Historical events (pre-2025) are assumed correct — only check recent events
- When in doubt, keep the event (false negatives are better than false positives)
- Return remove_ids as the list of node IDs to remove
- Return reasons as a dict mapping each removed node ID to a brief explanation""",
    retries=1,
)
```

#### 2.3 过滤逻辑

```python
async def _filter_hallucinations(
    self,
    nodes: list[dict],
) -> list[dict]:
    """Remove hallucinated recent events that lack search evidence."""
    # 收集 2025+ 节点
    recent_nodes = [n for n in nodes if n["date"] >= "2025"]
    if not recent_nodes:
        return nodes

    # 构造 prompt：每个近期节点 + 其搜索 context
    lines = []
    for node in recent_nodes:
        ctx = self._detail_contexts.get(node["id"], "No search results.")
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
        return [n for n in nodes if n["id"] not in remove_ids]
    except Exception:
        logger.warning("Hallucination check failed, keeping all nodes")
        return nodes

    finally:
        self._detail_contexts.clear()  # 释放内存
```

设计考量：
- 只传 2025+ 节点给 LLM（通常 5-10 个），token 很少
- 失败时保留所有节点（降级不崩溃）
- 用完后清空 `_detail_contexts`
- `date >= "2025"` 的字符串比较有效，因为日期格式是 `YYYY-MM-DD`

### 3. 子任务 B：补盲 + 因果关系（Gap Analysis Agent）

#### 3.1 模型定义

```python
# models/research.py
class ConnectionType(StrEnum):
    CAUSED = "caused"
    ENABLED = "enabled"
    INSPIRED = "inspired"
    RESPONDED_TO = "responded_to"

class TimelineConnection(BaseModel):
    from_id: str
    to_id: str
    relationship: str  # 如"直接推动了"、"为...奠定基础"
    type: ConnectionType

class GapAnalysisResult(BaseModel):
    gap_nodes: list[SkeletonNode]
    connections: list[TimelineConnection]
```

#### 3.2 Agent 定义

新文件 `backend/app/agents/gap_analysis.py`。用 Sonnet 4.5（需要全局推理）。

```python
gap_analysis_agent = Agent(
    OpenRouterModel(settings.gap_analysis_model, provider=provider),
    output_type=GapAnalysisResult,
    instructions="""\
You are a timeline analysis specialist. You receive a complete timeline \
of milestone events and must perform two tasks:

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
- Output all text fields in the language specified by the user""",
    retries=2,
)
```

为什么单独建文件而非放 orchestrator.py：
- orchestrator.py 已经有 440 行，再加一个 agent 会太长
- gap analysis 有独立的 prompt 和逻辑，值得独立模块
- 和 synthesizer.py 同级

#### 3.3 `run_gap_analysis_agent()` 函数

```python
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
```

输入：只传 id + date + title + description（不传 details，节省 token）。connections 需要 id 来建立引用关系。

不需要搜索——这个 Agent 做的是基于已有节点的分析，不是发现新事实。

### 4. config.py 新增配置

```python
gap_analysis_model: str = "anthropic/claude-sonnet-4.5"
```

### 5. SynthesisResult 扩展

connections 附加到 SynthesisResult，不新建独立的 SSE 事件。

```python
# models/research.py
class SynthesisResult(BaseModel):
    summary: str
    key_insight: str
    timeline_span: str
    source_count: int = 0
    verification_notes: list[str] = Field(default_factory=list)
    connections: list[TimelineConnection] = Field(default_factory=list)  # 新增
```

Synthesizer prompt 里明确写 `connections: leave empty (system will fill)`，和 sources 同理。

Orchestrator 在 Phase 4（Synthesis）阶段将 Phase 3 的 connections 合并进 synthesis_data：

```python
synthesis_data = synthesis.model_dump()
synthesis_data["source_count"] = source_count
synthesis_data["connections"] = [c.model_dump() for c in gap_connections]
await session.push(SSEEventType.SYNTHESIS, synthesis_data)
```

前端 `SynthesisData` 类型对应新增 connections 字段（可选，向后兼容）：

```typescript
export interface TimelineConnection {
  from_id: string;
  to_id: string;
  relationship: string;
  type: "caused" | "enabled" | "inspired" | "responded_to";
}

export interface SynthesisData {
  summary: string;
  key_insight: string;
  timeline_span: string;
  source_count: number;
  verification_notes: string[];
  connections?: TimelineConnection[];  // 新增，可选
}
```

### 6. Orchestrator 执行流程

在 `execute_research()` 的 Phase 2 和当前 Phase 3（Synthesis，将重编号为 Phase 4）之间插入：

```python
# --- Phase 2: Detail --- (已有)
...

# --- Phase 3: Gap Analysis ---
await session.push(
    SSEEventType.PROGRESS,
    {
        "phase": "analysis",
        "message": _get_progress_message("analysis", proposal.language),
        "percent": 0,
    },
)

# Step 3a: 编造过滤
nodes = await self._filter_hallucinations(nodes)

# 更新 skeleton（移除被过滤的节点）
await session.push(SSEEventType.SKELETON, {"nodes": nodes})

# Step 3b: 补盲 + 因果关系
gap_result = await self._run_gap_analysis(nodes, proposal)

# Step 3c: 补充节点的 detail enrichment
if gap_result.gap_nodes:
    new_nodes = []
    next_id = len(nodes) + 1
    for gap_node in gap_result.gap_nodes:
        node_dict = {
            "id": f"ms_{next_id:03d}",
            **gap_node.model_dump(),
            "status": "skeleton",
        }
        next_id += 1
        new_nodes.append(node_dict)

    # 推送新骨架节点
    nodes.extend(new_nodes)
    nodes.sort(key=lambda n: n["date"])
    await session.push(SSEEventType.SKELETON, {"nodes": nodes})

    # 并行 enrich 新节点
    async with asyncio.TaskGroup() as tg:
        for node in new_nodes:
            tg.create_task(_enrich_gap_node(node))

gap_connections = gap_result.connections

# --- Phase 4: Synthesis --- (原 Phase 3)
...
```

#### 6.1 `_run_gap_analysis()` 方法

```python
async def _run_gap_analysis(
    self,
    nodes: list[dict],
    proposal: ResearchProposal,
) -> GapAnalysisResult:
    try:
        return await run_gap_analysis_agent(
            topic=proposal.topic,
            language=proposal.language,
            nodes=nodes,
        )
    except Exception:
        logger.warning("Gap analysis failed, skipping")
        return GapAnalysisResult(gap_nodes=[], connections=[])
```

#### 6.2 `_enrich_gap_node()` 方法

直接复用 `_enrich_node`。`_enrich_node` 内部的 `if node["date"] >= "2025"` 已经控制了 context 存储，gap node 大多补的是历史空白（如 AI Winter），自然不触发。即使补了近期节点也无害——多存一个 context 而已。

### 7. Progress Messages

```python
_PROGRESS_MESSAGES 新增：
"analysis": {
    "zh": "正在分析时间线完整性...",
    "en": "Analyzing timeline completeness...",
    "ja": "タイムラインの完全性を分析中...",
},
```

### 8. SSE 事件流变化

原：`skeleton → detail × N → synthesis → complete`

新：`skeleton → detail × N → progress(analysis) → skeleton(filtered) → skeleton(with gaps) → node_detail × M → synthesis(with connections) → complete`

关键点：
- Phase 3 过滤后重新推送 skeleton 事件（前端用最新的 nodes 列表替换显示）
- gap nodes 补充后逐个推送 node_detail（复用已有事件）
- connections 附加在 synthesis 事件里

前端需要处理收到第二次 skeleton 事件的情况——当前 `useResearchStream.ts` 的 onSkeleton 回调直接设置节点列表，所以第二次 skeleton 会覆盖第一次，这正是我们想要的。

但需要确认：第二次 skeleton 推送的节点中，已有的节点保留它们的 details（`status: "complete"`），新增的 gap nodes 是 `status: "skeleton"`。

实际上，当前 skeleton 事件的 nodes 里 status 都是 "skeleton"，details 存在 node dict 里。前端 onSkeleton 回调创建新的 TimelineNode 对象。如果第二次 skeleton 覆盖了第一次，已有节点的 details 会丢失。

**解决方案**：前端 onSkeleton 回调改为"合并"模式——新 skeleton 来的节点如果已存在（by id），保留其 details 和 status：

```typescript
// useResearchStream.ts onSkeleton 回调
onSkeleton: (data) => {
    const newNodes = data.nodes.map(n => {
        const existing = nodesRef.current.find(e => e.id === n.id);
        if (existing && existing.details) {
            return { ...n, status: existing.status, details: existing.details };
        }
        return { ...n, status: "skeleton" as const };
    });
    setNodes(newNodes);
}
```

或者更简单：Phase 3 不重发完整 skeleton，而是：
- 过滤时发一个新事件 `nodes_removed`（包含被移除的 node IDs）
- 补盲时发 skeleton 事件只包含新增的 gap nodes

**更简单的方案**：新增 `NODES_REMOVED` SSE 事件类型，前端据此删除节点。gap nodes 通过一个新的 skeleton 事件只推送新增节点，前端 append 到列表。

但这增加了 SSE 协议复杂度。

**最终方案**：用现有 skeleton 事件推送完整的 nodes 列表。前端 onSkeleton 改为合并模式。这是最干净的——前端总是拿到最新的完整列表，不需要维护增删状态。

### 9. 前端适配

#### 9.1 `useResearchStream.ts`

onSkeleton 回调改为合并模式（保留已有 details）：

```typescript
onSkeleton: (data: { nodes: SkeletonNodeData[] }) => {
    setNodes(prev => {
        const existingMap = new Map(prev.map(n => [n.id, n]));
        return data.nodes.map(n => {
            const existing = existingMap.get(n.id);
            if (existing?.details) {
                return { ...n, status: "complete" as const, details: existing.details };
            }
            return { ...n, status: "skeleton" as const };
        });
    });
}
```

#### 9.2 `types/index.ts`

新增 `TimelineConnection` 类型，`SynthesisData` 增加可选 connections 字段。

#### 9.3 `Timeline.tsx`

暂不渲染 connections。数据存着，后续做因果线可视化。

## 错误处理

- 编造过滤失败 → 保留所有节点（降级不崩溃）
- Gap analysis 失败 → 跳过补盲和因果（返回空 gap_nodes + 空 connections）
- gap node 的 detail enrichment 失败 → 跳过该节点的 detail（已有 try/except）
- 任何一步失败都不阻塞后续 Phase 4（Synthesis）

## 预估耗时

| 步骤 | 模型 | 调用次数 | 预计耗时 |
|------|------|---------|---------|
| 编造过滤 | DeepSeek V3 | 1 | ~2 秒 |
| Gap analysis | Sonnet 4.5 | 1 | ~5 秒 |
| Gap nodes detail | DeepSeek V3 | 0-5 | ~0-15 秒 |
| **总计** | | | **~7-22 秒** |

与设计文档预估的 15-25 秒吻合。

## 预估成本

- 编造过滤：DeepSeek V3，~500 tokens input → ~$0.001
- Gap analysis：Sonnet 4.5，~2000 tokens input → ~$0.01
- Gap detail：DeepSeek V3 × 3，每次 ~500 tokens → ~$0.003
- **总计**：~$0.014/次调研，可忽略

## 验证

用"人工智能"跑完整流程：
- [ ] 编造的未来事件（如"首个AI法律人格案例判决 2025-11"、"全球AI伦理监管联盟成立 2026-02"）应被移除
- [ ] 应该补充 1-3 个缺失节点（如 AI Winter、GPT-4）
- [ ] connections 应包含 10+ 条因果关系（如 Transformer → GPT 系列）
- [ ] 总节点数应在 30-40 范围（原 39 过滤掉 3-5 个编造，补回 1-3 个缺失）
- [ ] 完整事件流正常：skeleton → detail × N → progress(analysis) → skeleton(filtered+gaps) → node_detail × M → synthesis → complete
- [ ] 前端第二次 skeleton 事件正确合并（已有 details 不丢失）

用"iPhone"跑回归测试：
- [ ] iPhone 时间线几乎没有 2025+ 节点，编造过滤应该是 no-op
- [ ] gap analysis 可能补充 1-2 个节点
- [ ] 不回归

## Todo List

### Phase A: 数据结构 + 配置

- [x] `models/research.py` 新增 `ConnectionType`, `TimelineConnection`, `GapAnalysisResult`, `HallucinationCheckResult`
- [x] `models/research.py` 的 `SynthesisResult` 新增 `connections` 字段
- [x] `config.py` 新增 `gap_analysis_model`
- [x] `frontend/src/types/index.ts` 新增 `TimelineConnection`，`SynthesisData` 加 connections

### Phase B: Detail Agent 返回 context

- [x] `detail.py` 的 `run_detail_agent()` 返回 `tuple[NodeDetail, str]`
- [x] `orchestrator.py` 的 `_enrich_node` 适配 tuple 解包，存 `_detail_contexts`

### Phase C: 编造过滤

- [x] `orchestrator.py` 新增 `_hallucination_agent` + `HallucinationCheckResult`
- [x] `orchestrator.py` 新增 `_filter_hallucinations()` 方法

### Phase D: Gap Analysis Agent

- [x] 新建 `backend/app/agents/gap_analysis.py`
- [x] `orchestrator.py` 新增 `_run_gap_analysis()` 方法
- [x] Synthesizer prompt 新增 "connections: leave empty (will be filled by the system)"
- [x] gap_analysis_agent system prompt 加入语言输出指令

### Phase E: Orchestrator 编排

- [x] `execute_research()` 插入 Phase 3 逻辑（过滤 → 补盲 → gap detail）
- [x] 新增 progress message "analysis"
- [x] connections 合并到 synthesis_data
- [x] 复用 `_enrich_node` 处理 gap nodes（不新建方法）
- [x] Gap node ID 用 max(existing IDs) + 1 避免冲突
- [x] Phase 3 后始终推送 skeleton（即使无 gap nodes）

### Phase F: 前端适配

- [x] `ChronoApp.tsx` onSkeleton 改为合并模式（Map-based merge 保留已有 details）
- [x] 确认第二次 skeleton 事件不丢失已有 details

### Phase G: 验证

- [x] `ruff check && ruff format && pnpm build` — 全部通过
- [x] "人工智能"测试：过滤 3 个编造节点（物理AI突破、AGI风险、世界模型），15 条 connections ✅
- [x] "iPhone"测试：过滤 4 个编造节点（折叠屏、全息投影、神经接口、量子加密），补 5 个 gap（iPhone发售、4s/Siri、SE、11多摄、Vision Pro），12 条 connections ✅
