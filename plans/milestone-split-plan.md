# Milestone Split — Implementation Plan

## 概述

将 Milestone 阶段从"单次调用生成所有节点"改为"按 `research_threads` 拆分，每个维度独立并行调用"。同时排查 sources 为空的问题。

## 涉及文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `backend/app/agents/milestone.py` | 重写 | 新 prompt + 新签名 |
| `backend/app/orchestrator/orchestrator.py` | 修改 | 新增 `_run_milestone_phase()`，替换原 Phase 1 逻辑 |
| `backend/app/config.py` | 不改 | 不需要 milestone_concurrency，threads 数量少 |

前端不需要改动——skeleton 事件的数据结构不变，只是节点数量变多。

## 详细设计

### 1. `run_milestone_agent()` 新签名

```python
async def run_milestone_agent(
    topic: str,
    thread_name: str,
    thread_description: str,
    estimated_nodes: int,
    language: str,
    tavily: TavilyService,
) -> MilestoneResult:
```

从"整个 topic"变为"topic 下的一个维度"。`estimated_nodes` 是该维度的目标节点数，来自 proposal 的 `ResearchThread.estimated_nodes`。

prompt 构造：

```python
prompt = (
    f"Topic: {topic}\n"
    f"Research dimension: {thread_name}\n"
    f"Dimension description: {thread_description}\n"
    f"Target node count: {estimated_nodes}"
)
```

### 2. Milestone Agent system prompt 重写

当前 prompt 存在的问题：
- 把 Agent 定位为"整个 topic 的骨架构建者"，需要改为"某个维度的里程碑挖掘者"
- 节点数参考只有 light/medium，缺 deep/epic
- 搜索策略太宽泛

新 prompt 设计要点：

```
你是 Chrono 时间线调研系统的里程碑研究专家。
你的任务是为一个特定的调研维度（research dimension）挖掘里程碑事件。

你会收到：
- Topic: 调研的总主题
- Research dimension: 你负责的具体维度
- Dimension description: 维度的具体说明
- Target node count: 你需要生成的目标节点数（允许 ±20% 浮动）

## 工作流程

### Step 1: 凭自身知识列出里程碑
基于你的知识，列出这个维度下的关键事件。
注意：只列属于你负责的维度的事件，不要跨维度。
尽可能接近目标节点数。宁可多列一些再精选，不要少于目标。

### Step 2: 验证性搜索
搜索 1-2 次，验证日期准确性并补充遗漏事件。
搜索词应聚焦你的维度，例如：
- "{topic} {dimension_name} milestones timeline"
- "{topic} {dimension_name} key events history"

### Step 3: 搜索近期信息
搜索 1 次，查找该维度最近 1-2 年的动态。
搜索词如 "{topic} {dimension_name} latest 2025 2026"

### Step 4: 定稿输出
- 按时间正序排列
- 评估重要度: revolutionary / high / medium
- date 用 ISO 格式
- description 写 2-3 句概述
- sources: 将搜索到的相关 URL 填入对应节点

## 约束
- 目标节点数 ±20%，不要大幅偏离
- revolutionary 级别的节点应少（0-2 个），大部分是 high 或 medium
- 每个节点的 sources 字段：如果搜索结果覆盖了这个事件，填入 URL；
  如果该节点纯来自自身知识且搜索未覆盖，sources 留空即可
- 使用输入 topic 的语言输出所有文本字段
```

关键变化：
- "目标节点数 ±20%"是硬约束，不再是"参考"
- 搜索策略围绕维度收窄
- 不写死搜索次数——`UsageLimits(request_limit=10)` 兜底，让 LLM 自己决定搜几次
- sources 的要求更明确："搜索覆盖到了就填，没覆盖到就空"——这降低了 LLM 编造 URL 的风险

### 3. Orchestrator `_run_milestone_phase()`

新增一个方法提取 Phase 1 逻辑：

```python
async def _run_milestone_phase(
    self, proposal: ResearchProposal
) -> list[dict]:
    raw_nodes: list[SkeletonNode] = []

    async def _run_thread(thread: ResearchThread) -> list[SkeletonNode]:
        result = await run_milestone_agent(
            topic=proposal.topic,
            thread_name=thread.name,
            thread_description=thread.description,
            estimated_nodes=thread.estimated_nodes,
            language=proposal.language,
            tavily=self.tavily,
        )
        return result.nodes

    async with asyncio.TaskGroup() as tg:
        tasks = [
            tg.create_task(_run_thread(thread))
            for thread in proposal.research_threads
        ]

    for task in tasks:
        raw_nodes.extend(task.result())

    # 合并：排序 + 去重
    merged = _merge_and_dedup(raw_nodes)

    # 转为 dict，加 id
    nodes = []
    for i, node in enumerate(merged, start=1):
        nodes.append({
            "id": f"ms_{i:03d}",
            **node.model_dump(),
            "status": "skeleton",
        })
    return nodes
```

**并行策略**：所有 threads 同时 spawn，无 Semaphore。理由：
- threads 数量少（1-6 个），不需要限流
- 每个 thread 内部的搜索量也小（2-3 次）
- Tavily API 和 OpenRouter 的 rate limit 远高于这个并行度

如果后续 Epic 级别出现 rate limit 问题，再加 `milestone_concurrency` 配置。

### 4. 合并去重逻辑 `_merge_and_dedup()`

不同维度可能产生相同事件（如"人工智能"的"技术演进"和"应用产业化"维度都可能列出 ChatGPT）。需要去重。

```python
def _merge_and_dedup(nodes: list[SkeletonNode]) -> list[SkeletonNode]:
    # 1. 按 date 排序
    sorted_nodes = sorted(nodes, key=lambda n: n.date)

    # 2. 去重：日期相同 + 标题相似
    merged: list[SkeletonNode] = []
    for node in sorted_nodes:
        if _is_duplicate(node, merged):
            continue
        merged.append(node)

    return merged
```

**重复判定标准** `_find_duplicate()`：

在 `merged` 中查找是否已存在"日期接近（≤30天）且标题相似"的节点。

> **批注采纳**: 日期严格相等太严格，不同维度对同一事件可能给出不同近似日期。改为 ≤30 天。

```python
def _find_duplicate(node: SkeletonNode, existing: list[SkeletonNode]) -> int | None:
    """Return index of duplicate in existing, or None."""
    d1 = date.fromisoformat(node.date)
    for i, ex in enumerate(existing):
        d2 = date.fromisoformat(ex.date)
        if abs((d1 - d2).days) > 30:
            continue
        if _titles_similar(node.title, ex.title):
            return i
    return None
```

标题相似度判断 `_titles_similar()`：

```python
def _titles_similar(a: str, b: str) -> bool:
    words_a = set(a.lower().split())
    words_b = set(b.lower().split())
    # 中文 fallback：split() 对中文只产生 1 个 token
    if len(words_a) <= 1 and len(words_b) <= 1:
        chars_a, chars_b = set(a), set(b)
        return len(chars_a & chars_b) / min(len(chars_a), len(chars_b)) >= 0.6
    if not words_a or not words_b:
        return False
    return len(words_a & words_b) / min(len(words_a), len(words_b)) >= 0.5
```

> **批注采纳**: 去重时合并信息而非丢弃。重复时 significance 取更高的，sources 合并（union），description 保留更长的。

合并逻辑：

```python
def _merge_into(target: SkeletonNode, source: SkeletonNode) -> SkeletonNode:
    """Merge source into target, keeping the better fields from each."""
    sig = source.significance if _sig_rank(source.significance) > _sig_rank(target.significance) else target.significance
    desc = source.description if len(source.description) > len(target.description) else target.description
    sources = list(set(target.sources) | set(source.sources))
    return target.model_copy(update={"significance": sig, "description": desc, "sources": sources})
```

设计考量：
- 用词重叠而非精确匹配，因为不同维度可能对同一事件有不同措辞（"ChatGPT 发布" vs "ChatGPT Launch"）
- 阈值 0.5 = 超过一半的词重复，避免过度去重
- 中文 fallback：`split()` 对中文只产出 1 个 token，退回字符级重叠（阈值 0.6）

### 5. `execute_research()` 中 Phase 1 替换

原来：

```python
milestone_result = await run_milestone_agent(
    topic=proposal.topic,
    language=proposal.language,
    tavily=self.tavily,
)
nodes = []
for i, node in enumerate(milestone_result.nodes, start=1):
    nodes.append({...})
```

改为：

```python
nodes = await self._run_milestone_phase(proposal)
```

一行替换，Phase 2/3 的代码不动。

### 6. Sources 为空问题调查

#### 6.1 问题背景

"人工智能" 测试中，所有 6 个 skeleton 节点 `sources: []`。说明 Milestone Agent 很可能跳过了 tool call，直接输出了结构化结果。

但 "iPhone" 测试中确实有 sources（每个节点 2 个 URL）。行为不一致。

#### 6.2 调查方案

在 `run_milestone_agent()` 中临时加 debug logging，检查 `result.all_messages()`：

```python
async def run_milestone_agent(...) -> MilestoneResult:
    ...
    result = await milestone_agent.run(prompt, deps=deps, usage_limits=...)

    # Debug: 检查是否有 tool call
    for msg in result.all_messages():
        if hasattr(msg, 'parts'):
            for part in msg.parts:
                if hasattr(part, 'tool_name'):
                    logger.info("Milestone tool call: %s(%s)", part.tool_name, part.args)

    return result.output
```

这段 debug 代码只用于验证，确认后移除。

#### 6.3 可能的原因和对策

| 可能原因 | 验证方式 | 对策 |
|----------|----------|------|
| LLM 直接跳过 tool call 输出结果 | 检查 `all_messages()` 是否有 ToolCallPart | prompt 更强调"你必须搜索" |
| LLM 调了 tool 但没把 URL 写入 sources | 检查 tool return 中是否有 URL | prompt 中明确 "将搜索结果中的 URL 填入 sources" |
| DeepSeek V3 对中文 prompt 的 tool use 不稳定 | 对比中英文 prompt 的 tool call 率 | 如果确认，考虑 milestone 也用 Sonnet |

新的 per-thread prompt 已经在约束中强调了 sources 要求，加上维度更聚焦（搜索次数 2-3 次足够），预期会改善。但仍需通过 debug logging 确认。

## 错误处理

- 单个 thread 的 milestone 调用失败 → catch + log warning，跳过该 thread，不影响其他 threads
- 需要在 `_run_thread` 内部 try/except，和 Detail Agent 的 `_enrich_node` 模式一致
- 如果所有 threads 都失败 → `nodes` 为空 → skeleton 事件推送空数组 → 前端显示空状态

```python
async def _run_thread(thread: ResearchThread) -> list[SkeletonNode]:
    try:
        result = await run_milestone_agent(...)
        return result.nodes
    except Exception:
        logger.warning("Milestone agent failed for thread: %s", thread.name)
        return []
```

## Todo List

> **批注采纳**: Phase A+B 合并——debug logging 直接加在新签名的 `run_milestone_agent()` 里。

### Phase A: Milestone Agent 改造 + Sources 调查

- [x] 重写 `milestone.py`：新 system prompt（维度聚焦、目标节点数、无搜索次数硬限制） ✅
- [x] 修改 `run_milestone_agent()` 签名 + prompt 构造 ✅
- [x] 加 debug logging（`result.all_messages()` 检查 tool call），验证后移除 ✅
- [x] `UsageLimits(request_limit=10)` ✅

### Phase B: Orchestrator 改造

- [x] 新增 `_merge_and_dedup()` 函数（日期 ≤30天 + 标题相似 → 合并 significance/sources/description） ✅
- [x] 新增 `_run_milestone_phase()` 方法（TaskGroup 并行 threads） ✅
- [x] `execute_research()` 中替换 Phase 1 调用为 `_run_milestone_phase()` ✅
- [x] `ruff check && ruff format` ✅

### Phase C: 端到端验证

- [x] curl "人工智能"（Deep, 5 threads）→ 19 nodes（原来 6），覆盖度大幅提升 ✅
- [x] debug logging 确认：部分 thread 跳过 tool call（DeepSeek V3 行为不稳定），部分正常搜索 ✅
- [x] 移除 debug logging ✅
- [x] curl "iPhone"（Light, 2 threads）→ 13 nodes（原来 8），4 with sources ✅
- [x] 完整事件流正常（skeleton → detail × N → synthesis → complete） ✅

### Sources 调查结论

debug logging 确认了根因：**DeepSeek V3 非确定性地跳过 tool call**。

iPhone 测试中 2 个 threads：
- "产品迭代与技术创新": 0 次 search，直接输出（sources 全空）
- "生态系统与行业影响": 6 次 search，正常流程（4 个节点有 sources）

行为不一致且不可控。可能的后续对策：
1. prompt 中更强硬地要求搜索（"你必须至少搜索 1 次"）
2. 对 sources 为空的节点由 Detail Agent 补充（已有此能力）
3. 对关键维度（priority 5）考虑使用更可靠的模型

当前不阻塞，skeleton sources 不是核心功能——Detail Agent 会独立搜索补充。
