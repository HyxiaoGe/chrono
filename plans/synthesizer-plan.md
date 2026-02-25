# Synthesizer Agent — Implementation Plan

## 概述

在 Detail Agent 完成后、complete 事件之前，加入 Synthesizer Agent（Phase 3），对完整时间线做综合校验并生成 summary。使用 Sonnet 4.5，不需要搜索工具，纯 LLM 推理。

## 涉及文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `backend/app/models/research.py` | 修改 | 新增 SynthesisResult model, SYNTHESIS SSEEventType |
| `backend/app/agents/synthesizer.py` | 新建 | Synthesizer Agent 定义 |
| `backend/app/orchestrator/orchestrator.py` | 修改 | 插入 Phase 3 编排逻辑 |
| `frontend/src/types/index.ts` | 修改 | 新增 SynthesisData 类型 |
| `frontend/src/hooks/useResearchStream.ts` | 修改 | 新增 onSynthesis callback |
| `frontend/src/components/ChronoApp.tsx` | 修改 | 新增 synthesisData state |
| `frontend/src/components/Timeline.tsx` | 修改 | 渲染 synthesis summary |

## 详细设计

### 1. SynthesisResult model (`models/research.py`)

```python
class SynthesisResult(BaseModel):
    summary: str  # 3-5 句话的整体概述
    key_insight: str  # 最重要的一个发现/洞察
    timeline_span: str  # 时间跨度描述，如 "2007-2024, 17 years"
    source_count: int  # 总引用来源数
    verification_notes: list[str]  # 交叉验证发现的问题或修正（可为空）

class SSEEventType(StrEnum):
    ...
    SYNTHESIS = "synthesis"  # 新增
```

设计考量：
- `summary` 是核心字段，面向用户展示
- `key_insight` 提炼一句话亮点
- `timeline_span` 由 LLM 从节点日期中归纳
- `source_count` 统计所有节点的去重来源数
- `verification_notes` 记录校验发现（如"某节点日期存疑"），为空说明没发现问题

### 2. Synthesizer Agent (`agents/synthesizer.py`)

```python
from pydantic_ai import Agent
from pydantic_ai.models.openrouter import OpenRouterModel

from app.config import settings
from app.models.research import SynthesisResult
from app.services.llm import provider

synthesizer_agent = Agent(
    OpenRouterModel(settings.synthesizer_model, provider=provider),
    output_type=SynthesisResult,
    instructions="""...""",
    retries=2,
)

async def run_synthesizer_agent(
    topic: str,
    language: str,
    nodes: list[dict],
) -> SynthesisResult:
    # 构造输入 prompt：topic + 完整节点列表（含 details）
    prompt = _build_synthesis_prompt(topic, language, nodes)
    result = await synthesizer_agent.run(prompt)
    return result.output
```

关键设计：
- **无 deps_type**：不需要 AgentDeps，没有搜索工具
- **无 @agent.tool**：纯推理，不调用外部工具
- **无 UsageLimits**：只需 1 次 LLM 调用，默认 limit 足够
- **`_build_synthesis_prompt()`**：将完整时间线序列化为结构化文本

Prompt 模板（英文）：

```
Topic: {topic}

You are reviewing a completed timeline research. Below are all {N} milestone nodes
with their details. Analyze the full timeline and produce a synthesis.

## Timeline Nodes

### Node 1: {title} ({date})
- Significance: {significance}
- Description: {description}
- Key Features: {key_features}
- Impact: {impact}
- Key People: {key_people}
- Context: {context}

### Node 2: ...
(repeat for all nodes)

## Your Tasks

1. Write a summary (3-5 sentences) that captures the overall narrative arc
2. Identify the single most important insight or pattern
3. State the timeline span (earliest date to latest date, with duration)
4. Count unique sources across all nodes
5. Cross-validate: flag any inconsistencies, questionable dates, or contradictions
   between nodes. If everything checks out, return an empty list.

Output language: {language}
```

### 3. Orchestrator 集成 (`orchestrator/orchestrator.py`)

在 Phase 2 (Detail) 完成后插入 Phase 3：

```python
# --- Phase 3: Synthesis ---
await session.push(
    SSEEventType.PROGRESS,
    {
        "phase": "synthesis",
        "message": _get_progress_message("synthesis", proposal.language),
        "percent": 0,
    },
)

try:
    synthesis = await run_synthesizer_agent(
        topic=proposal.topic,
        language=proposal.language,
        nodes=nodes,  # nodes 列表已被 _enrich_node 更新了 details
    )
    await session.push(
        SSEEventType.SYNTHESIS,
        synthesis.model_dump(),
    )
except Exception:
    logger.warning("Synthesizer failed, skipping synthesis")
    # 不 raise，synthesis 失败不阻塞 complete

# --- Complete ---
await session.push(SSEEventType.COMPLETE, {...})
```

需要新增 progress message：

```python
_PROGRESS_MESSAGES: dict[str, dict[str, str]] = {
    ...
    "synthesis": {
        "zh": "正在生成调研总结...",
        "en": "Generating research summary...",
        "ja": "調査サマリーを生成中...",
    },
}
```

**关键点**：`nodes` 列表的数据传递。当前 `_enrich_node` 通过 `session.push` 推送 detail，但 `nodes` 列表本身（orchestrator 局部变量）只包含骨架数据。需要在 `_enrich_node` 中同时更新 `nodes` 列表中对应节点的 details 字段，这样 Synthesizer 才能拿到完整数据。

修改 `_enrich_node`：

```python
async def _enrich_node(node: dict) -> None:
    nonlocal detail_completed
    async with sem:
        try:
            detail = await run_detail_agent(...)
        except Exception:
            logger.warning(...)
            return
    detail_completed += 1
    node["details"] = detail.model_dump()  # 回写到 node dict
    await session.push(SSEEventType.NODE_DETAIL, {...})
```

由于 `node` 是 dict（可变引用），直接赋值 `node["details"]` 即可。TaskGroup 完成后 `nodes` 列表中的每个 node 都会带上 details（失败的除外）。

### 4. 前端类型 (`types/index.ts`)

```typescript
export interface SynthesisData {
  summary: string;
  key_insight: string;
  timeline_span: string;
  source_count: number;
  verification_notes: string[];
}
```

### 5. SSE hook (`hooks/useResearchStream.ts`)

```typescript
interface StreamCallbacks {
  ...
  onSynthesis?: (data: SynthesisData) => void;
}

// 在 useEffect 中新增：
listen<SynthesisData>("synthesis", (d) => cbRef.current.onSynthesis?.(d));
```

### 6. ChronoApp state (`components/ChronoApp.tsx`)

```typescript
const [synthesisData, setSynthesisData] = useState<SynthesisData | null>(null);

// 新增 callback：
onSynthesis: useCallback((data: SynthesisData) => {
  setSynthesisData(data);
}, []),

// 传给 Timeline：
<Timeline
  nodes={nodes}
  progressMessage={progressMessage}
  completeData={completeData}
  synthesisData={synthesisData}
  language={language}
/>
```

### 7. Timeline 渲染 (`components/Timeline.tsx`)

在时间线节点列表之后、complete 状态栏之前，渲染 synthesis summary：

```tsx
{synthesisData && (
  <div className="mt-12 rounded-lg border border-zinc-800 bg-zinc-900/50 p-6">
    <h3 className="mb-3 text-sm font-medium text-zinc-400">
      {isZh ? "调研总结" : "Research Summary"}
    </h3>
    <p className="mb-4 text-zinc-300 leading-relaxed">
      {synthesisData.summary}
    </p>
    <p className="text-sm text-zinc-400 italic">
      {synthesisData.key_insight}
    </p>
    <div className="mt-4 flex gap-4 text-xs text-zinc-600">
      <span>{synthesisData.timeline_span}</span>
      <span>·</span>
      <span>
        {isZh
          ? `${synthesisData.source_count} 个来源`
          : `${synthesisData.source_count} sources`}
      </span>
    </div>
    {synthesisData.verification_notes.length > 0 && (
      <div className="mt-3 text-xs text-amber-500/70">
        {synthesisData.verification_notes.map((note, i) => (
          <p key={i}>⚠ {note}</p>
        ))}
      </div>
    )}
  </div>
)}
```

## 错误处理策略

- Synthesizer 失败（LLM 超时、返回格式错误等）→ catch 异常，log warning，跳过 synthesis 事件，直接发 complete
- 前端未收到 synthesis 事件 → synthesisData 保持 null，Timeline 不渲染 summary 区域，不影响其他功能

## 权衡取舍

1. **不回写 significance**：技术方案提到"重要性重新评估"，但回写需要额外的 `node_update` SSE 事件和前端处理逻辑。当前阶段 summary 里提及即可，后续需要时再加。
2. **不截断长时间线**：Deep/Epic 级调研节点多，输入 token 可能较大。当前阶段先不做截断，Sonnet 4.5 的 context window (200K) 足够处理。如果遇到问题再加截断策略。
3. **source_count 由 LLM 计算**：也可以在 orchestrator 中用 Python 统计，但放在 LLM prompt 里可以让它在分析过程中自然统计，避免额外代码。

## Todo List

### Phase A: 后端

- [x] 在 `models/research.py` 新增 `SynthesisResult` model 和 `SYNTHESIS` SSEEventType ✅
- [x] 新建 `agents/synthesizer.py`：Agent 定义 + prompt + `run_synthesizer_agent()` ✅
- [x] 修改 `orchestrator/orchestrator.py`： ✅
  - `_enrich_node` 中回写 `node["details"]`
  - 新增 synthesis progress message
  - 插入 Phase 3 编排逻辑（含 try/except 容错）
  - `source_count` 由 Python 在 Orchestrator 层计算（set 去重），覆盖 LLM 返回值
- [x] `ruff check && ruff format` 验证 ✅

### Phase B: 前端

- [x] `types/index.ts` 新增 `SynthesisData` ✅
- [x] `hooks/useResearchStream.ts` 新增 `onSynthesis` ✅
- [x] `components/ChronoApp.tsx` 新增 state + callback + prop 传递 ✅
- [x] `components/Timeline.tsx` 渲染 synthesis summary ✅
- [x] ESLint + TypeScript 验证 ✅

### Phase C: 端到端验证

- [x] curl 验证完整 SSE 事件流：progress → skeleton → progress → node_detail × 8 → progress(synthesis) → synthesis → complete ✅
- [x] 确认 synthesis 事件包含所有字段（summary, key_insight, timeline_span, source_count=10, verification_notes with 2 findings） ✅
