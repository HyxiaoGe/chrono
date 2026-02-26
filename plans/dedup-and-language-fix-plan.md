# Dedup & Language Fix — Implementation Plan

## 概述

两个独立但相关的改动：

1. **去重逻辑重写**：当前基于文本相似度的去重在跨语言标题和近似日期上失败，改为"按年分组 + LLM 快速去重"
2. **Milestone Agent 语言约束**：强制 Milestone Agent 输出与 topic 语言一致的文本

## 问题背景

"人工智能" Deep 级测试（5 threads）产出 47 个 raw nodes。当前文本去重效果差：

- "DALL-E 2发布" vs "DALL-E 2 Image Generation" → 不同语言描述同一事件，词重叠为 0
- "ChatGPT 发布" vs "ChatGPT Launch" → 同上
- 部分 thread 用英文输出（DeepSeek V3 语言不可控），导致跨语言重复无法检测

## 涉及文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `backend/app/orchestrator/orchestrator.py` | 修改 | 删除旧去重函数，新增 LLM 去重逻辑 |
| `backend/app/agents/milestone.py` | 修改 | prompt 末尾追加语言硬约束 |
| `backend/app/models/research.py` | 不改 | SkeletonNode 结构不变 |
| `backend/app/config.py` | 不改 | 去重用 milestone_model（DeepSeek V3），不需要新配置 |

前端不需要改动。

## 详细设计

### 改动一：去重逻辑重写

#### 1.1 整体思路

替换当前的 `_titles_similar()` + `_find_duplicate()` + `_merge_and_dedup()` 为：

1. 按年分组（减少 LLM 输入量、提高准确率）
2. 每组 ≥2 个节点时，调 LLM 识别重复组
3. 合并重复组的信息（不丢弃）
4. 所有组合并，按日期排序输出

#### 1.2 Dedup Agent

定义在 `orchestrator.py` 内部，不单独建文件。使用 DeepSeek V3（`settings.milestone_model`，最便宜）。

```python
class DedupGroup(BaseModel):
    """A group of node indices that refer to the same event."""
    indices: list[int]

class DedupResult(BaseModel):
    duplicate_groups: list[DedupGroup]

_dedup_agent = Agent(
    OpenRouterModel(settings.milestone_model, provider=provider),
    output_type=DedupResult,
    instructions="""You are a dedup specialist. Given a list of timeline events (with index, date, title),
identify groups of events that refer to the SAME real-world event.

Rules:
- Two events are duplicates if they describe the same real-world occurrence, even if titles are in different languages or worded differently
- Date proximity matters: events more than 365 days apart are almost certainly NOT duplicates
- Return only groups with 2+ items. Events that have no duplicate should NOT appear in any group
- Each event index should appear in at most one group
- Output an empty duplicate_groups list if there are no duplicates""",
    retries=1,
)
```

设计考量：
- **无 tools**：纯推理任务，不需要搜索
- **无 deps**：不需要 AgentDeps
- **retries=1**：去重失败可以 fallback 到不去重，不值得多次重试
- **英文 prompt**：去重是跨语言任务，LLM 用英文推理更稳定
- **output_type 是 Pydantic model**：`list[list[int]]` 不是合法的 Pydantic AI output_type，需要包一层

#### 1.3 分组策略

```python
def _group_by_year(nodes: list[SkeletonNode]) -> dict[str, list[tuple[int, SkeletonNode]]]:
    """Group nodes by year. Nodes with unparseable dates go into 'unknown'."""
    groups: dict[str, list[tuple[int, SkeletonNode]]] = {}
    for i, node in enumerate(nodes):
        try:
            year = str(date.fromisoformat(node.date).year)
        except ValueError:
            year = "unknown"
        groups.setdefault(year, []).append((i, node))
    return groups
```

为什么按年不按更小粒度：
- 同一事件不同 thread 可能给出不同月份（如 "2022-11" vs "2022-12" 描述同一个 ChatGPT 发布）
- 年粒度足够——一年内的事件数通常 < 15，LLM 处理毫无压力
- 跨年边界的重复（12 月 vs 1 月）概率极低，可忽略

#### 1.4 LLM 去重调用

```python
async def _dedup_year_group(
    nodes_with_idx: list[tuple[int, SkeletonNode]],
) -> list[list[int]]:
    """Call LLM to find duplicates within a year group. Returns groups of original indices."""
    if len(nodes_with_idx) < 2:
        return []

    lines = []
    for orig_idx, node in nodes_with_idx:
        lines.append(f"[{orig_idx}] {node.date} | {node.title} | {node.description[:80]}")
    prompt = "Find duplicate events:\n" + "\n".join(lines)

    try:
        result = await _dedup_agent.run(prompt)
        return [g.indices for g in result.output.duplicate_groups]
    except Exception:
        logger.warning("Dedup agent failed for year group, skipping dedup")
        return []
```

设计考量：
- prompt 传 index + date + title + description[:80]（截断 80 字符）。标题差异大时 description 能显著提高准确率，token 增加可忽略
- 失败时返回空列表（不去重），不阻塞流程
- 返回原始 index（而非组内 index），方便合并

#### 1.5 合并逻辑

对每个重复组，选出一个 "winner" 并合并其他节点的信息。

```python
def _merge_duplicate_group(
    nodes: list[SkeletonNode], indices: list[int], language: str
) -> SkeletonNode:
    """Merge a group of duplicate nodes into one."""
    group = [nodes[i] for i in indices]

    # title: 优先选与 language 匹配的
    best_title_node = _pick_language_matching(group, language)

    # significance: 取最高
    best_sig = max(group, key=lambda n: _SIG_RANK.get(n.significance, 0)).significance

    # description: 取最长
    best_desc = max(group, key=lambda n: len(n.description)).description

    # sources: union
    all_sources = list({url for n in group for url in n.sources})

    # date: 优先精确日期（非 01-01 结尾的）
    best_date = _pick_precise_date(group)

    # subtitle: 取最长
    best_subtitle = max(group, key=lambda n: len(n.subtitle)).subtitle

    return SkeletonNode(
        date=best_date,
        title=best_title_node.title,
        subtitle=best_subtitle,
        significance=best_sig,
        description=best_desc,
        sources=all_sources,
    )
```

语言匹配判断：

```python
def _pick_language_matching(nodes: list[SkeletonNode], language: str) -> SkeletonNode:
    """Pick the node whose title best matches the target language."""
    if language in ("zh", "ja", "ko"):
        # CJK: 检查是否包含 CJK 字符
        for node in nodes:
            if any("\u4e00" <= ch <= "\u9fff" for ch in node.title):
                return node
    # fallback: 取最长标题
    return max(nodes, key=lambda n: len(n.title))
```

日期精确度判断：

```python
def _pick_precise_date(nodes: list[SkeletonNode]) -> str:
    """Pick the most precise date from a group."""
    # 优先选非 -01-01 结尾的（说明知道具体月/日）
    for node in nodes:
        if not node.date.endswith("-01-01"):
            return node.date
    return nodes[0].date
```

#### 1.6 新 `_merge_and_dedup()` 签名

```python
async def _merge_and_dedup(
    nodes: list[SkeletonNode], language: str
) -> list[SkeletonNode]:
    sorted_nodes = sorted(nodes, key=lambda n: n.date)

    # 按年分组
    year_groups = _group_by_year(sorted_nodes)

    # 对每个年组并行调 LLM 去重
    all_dup_groups: list[list[int]] = []
    async with asyncio.TaskGroup() as tg:
        tasks = [
            tg.create_task(_dedup_year_group(group))
            for group in year_groups.values()
        ]
    for task in tasks:
        all_dup_groups.extend(task.result())

    # 标记被合并掉的 index
    merged_away: set[int] = set()
    replacements: dict[int, SkeletonNode] = {}
    for group_indices in all_dup_groups:
        if len(group_indices) < 2:
            continue
        # winner_idx 只决定合并节点在最终列表中的位置（取组内第一个）。
        # 实际的 title/date 等字段选择由 _merge_duplicate_group 内部逻辑决定。
        winner_idx = group_indices[0]
        merged_node = _merge_duplicate_group(sorted_nodes, group_indices, language)
        replacements[winner_idx] = merged_node
        merged_away.update(group_indices[1:])

    # 重建列表
    result: list[SkeletonNode] = []
    for i, node in enumerate(sorted_nodes):
        if i in merged_away:
            continue
        if i in replacements:
            result.append(replacements[i])
        else:
            result.append(node)

    return result
```

#### 1.7 调用处修改

`_run_milestone_phase()` 中：

```python
# 原来
merged = _merge_and_dedup(raw_nodes)

# 改为
merged = await _merge_and_dedup(raw_nodes, proposal.language)
```

#### 1.8 删除的函数

以下函数全部删除：
- `_titles_similar()`
- `_find_duplicate()`
- 旧的 `_merge_and_dedup()`（替换为新的 async 版本）
- `_merge_into()`（替换为 `_merge_duplicate_group()`）

保留 `_SIG_RANK`（合并逻辑仍需要）。

### 改动二：Milestone Agent 语言约束

在 `milestone.py` 的 system prompt 末尾追加硬约束：

```
## CRITICAL: Language requirement
You MUST output ALL text fields (title, subtitle, description) in {language}.
This is a hard requirement. If the topic is in Chinese, output in Chinese.
If the topic is in English, output in English. Do NOT mix languages.
```

但 `{language}` 是运行时变量，不能写在 instructions 里。两个方案：

**方案 A**：在 `run_milestone_agent()` 的 user prompt 中追加语言要求

```python
prompt = (
    f"Topic: {topic}\n"
    f"Research dimension: {thread_name}\n"
    f"Dimension description: {thread_description}\n"
    f"Target node count: {estimated_nodes}\n\n"
    f"CRITICAL: You MUST output ALL text fields (title, subtitle, description) in {language}. "
    f"Do NOT use any other language."
)
```

**方案 B**：用 Pydantic AI 的 `system_prompt` 动态装饰器

```python
@milestone_agent.system_prompt
async def add_language_constraint(ctx: RunContext[AgentDeps]) -> str:
    return (
        f"\n## CRITICAL: Language requirement\n"
        f"You MUST output ALL text fields in {ctx.deps.language}. Do NOT mix languages."
    )
```

**选择方案 A**：更简单直接，不需要改 agent 定义。语言要求放在 user prompt 中也足够强——LLM 对 user message 中的指令比 system message 更敏感。

## 错误处理

- 单个年组的 LLM 去重失败 → 该组不去重，保留所有节点
- 所有年组都失败 → 等效于不去重，47 个节点全部保留（降级但不崩溃）
- `_merge_duplicate_group()` 不涉及外部调用，不会失败

## 性能评估

- "人工智能" 47 nodes 分到约 15 个年组
- 每个年组 1 次 DeepSeek V3 调用，token 极少（每组 < 200 tokens input）
- 并行调用，总耗时 ≈ 单次调用耗时（~1-2 秒）
- 比原来的 O(n²) 文本比较更智能，成本可忽略

## Todo List

### Phase A: 去重重写

- [x] 删除 `_titles_similar()`, `_find_duplicate()`, `_merge_into()`, 旧 `_merge_and_dedup()` ✅
- [x] 新增 `DedupGroup`, `DedupResult` models + `_dedup_agent` ✅
- [x] 新增 `_group_by_year()` ✅
- [x] 新增 `_dedup_year_group()` ✅
- [x] 新增 `_pick_language_matching()`, `_pick_precise_date()`, `_merge_duplicate_group()` ✅
- [x] 新增 async `_merge_and_dedup()` (with language param) ✅
- [x] 更新 `_run_milestone_phase()` 调用处 ✅

### Phase B: Milestone 语言约束

- [x] 在 `run_milestone_agent()` 的 prompt 中追加语言硬约束 ✅

### Phase C: 验证

- [x] `ruff check && ruff format` ✅
- [x] curl "人工智能" → 44 nodes（去重有效），所有标题中文 ✅
- [x] curl "iPhone" → 16 nodes，完整流程正常，无回归 ✅
- [x] 完整事件流正常（skeleton → detail × N → synthesis → complete） ✅

### 验证结果

**"人工智能"（Deep, 4 threads）**：44 nodes，所有标题中文（语言约束生效）。LLM 去重正常运行，无 warning 日志。

**"iPhone"（Light, 2 threads）**：16 nodes，完整事件流 skeleton → 16 node_detail → synthesis → complete。
