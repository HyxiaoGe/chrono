# Deterministic Search — Implementation Plan

## 概述

将搜索决策权从 LLM 收回到 Python 层。当前 Detail Agent 和 Milestone Agent 依赖 LLM 自己决定是否调用搜索 tool，但 DeepSeek V3 在结构化输出模式下不稳定地跳过 tool call，导致 sources 全空。

改为 RAG 模式：Python 代码强制执行搜索 → 搜索结果作为 context 塞进 prompt → LLM 只负责内容生成，不再需要 tool use。

## 涉及文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `backend/app/agents/detail.py` | 重写 | 移除 tool，改为 RAG 模式 |
| `backend/app/agents/milestone.py` | 重写 | 移除 tool，改为 RAG 模式 |
| `backend/app/services/tavily.py` | 修改 | 新增 `search_and_format()` 便捷方法 |
| `backend/app/agents/tools.py` | 删除 | `format_search_results()` 移入 TavilyService，此文件不再需要 |
| `backend/app/agents/deps.py` | 修改 | 移除 tavily 字段（agents 不再直接持有 tavily） |

不改的部分：
- Synthesizer Agent：纯推理，不需要搜索
- Dedup Agent：纯推理，不需要搜索
- Orchestrator：不需要改（`_run_milestone_phase` 和 `_enrich_node` 已传 tavily 参数）
- 前端 / SSE 协议：不变

## 详细设计

### 1. TavilyService 新增 `search_and_format()`

```python
async def search_and_format(
    self,
    query: str,
    *,
    max_results: int = 5,
) -> tuple[str, list[str]]:
    """搜索并返回 (formatted_context, source_urls)。"""
    response = await self.search(query, max_results=max_results)
    results = response.get("results", [])

    parts: list[str] = []
    urls: list[str] = []
    for i, r in enumerate(results, 1):
        url = r.get("url", "")
        title = r.get("title", "")
        snippet = r.get("content", "")[:300]
        parts.append(f"【{i}】{title}\nURL: {url}\n{snippet}")
        if url:
            urls.append(url)

    context = "\n\n".join(parts) if parts else "No search results found."
    return context, urls
```

设计考量：
- 返回 tuple 而非新 model——调用方需要 context（塞 prompt）和 urls（填 sources）两样东西，tuple 最简单
- 格式用编号 `【{i}】` 而非 markdown link，方便 LLM 引用（"参考【3】"）
- snippet 截断 300 字符（与当前 `format_search_results` 一致）
- 不包含 `answer` 字段——搜索摘要对 RAG 场景价值不大，snippet 更具体

### 2. Detail Agent 改造

#### 2.1 移除 tool，改为纯推理 Agent

```python
detail_agent = Agent(
    OpenRouterModel(settings.detail_model, provider=provider),
    output_type=NodeDetail,
    instructions="""...""",  # 重写，见下文
    retries=2,
)
# 不再有 @detail_agent.tool
# 不再有 deps_type=AgentDeps
```

无 tools + 无 deps → Agent 变成纯推理器，等同于 Synthesizer 的模式。

#### 2.2 新 system prompt

```
你是 Chrono 时间线调研系统的深度研究专家。你的任务是为时间线上的一个里程碑节点补充详细信息。

## 你会收到的信息

- 节点基本信息：日期、标题、概述、重要程度
- 搜索参考资料：已为你检索的相关资料（带编号和 URL）

## 输出要求

基于你的知识和提供的参考资料，填充以下字段：

- key_features: 3-5 条关键特性或要点（每条一句话）
- impact: 这个事件的影响和意义（2-3 句话）
- key_people: 关键人物列表（人名 + 一句话说明角色）。如果没有特定关键人物可以为空列表
- context: 背景和因果关系（2-3 句话）
- sources: 留空（系统会自动填充）

## 约束

- key_features 必须是具体的事实，不要写空泛的评价
- 如果参考资料与你的知识有冲突，以参考资料为准
- 使用指定的语言输出所有文本字段
```

关键变化：
- 删除所有搜索相关指令（Step 1/2/3 流程）
- 明确告知"搜索参考资料"的存在
- sources 字段告知"留空，系统自动填充"——避免 LLM 编造 URL
- 更简短，减少 token 消耗

#### 2.3 新 `run_detail_agent()` 签名

```python
async def run_detail_agent(
    node: dict,
    topic: str,
    language: str,
    tavily: TavilyService,
) -> NodeDetail:
    # Step 1: Python 强制搜索
    query = f"{topic} {node['title']} {node['date'][:4]}"
    context, urls = await tavily.search_and_format(query)

    # Step 2: 构造 prompt（含搜索 context）
    prompt = (
        f"Topic: {topic}\n"
        f"Date: {node['date']}\n"
        f"Title: {node['title']}\n"
        f"Description: {node['description']}\n"
        f"Significance: {node['significance']}\n\n"
        f"搜索参考资料:\n{context}\n\n"
        f"请使用 {language} 输出所有文本字段。"
    )

    # Step 3: LLM 纯推理
    result = await detail_agent.run(prompt)

    # Step 4: Python 填充 sources
    output = result.output
    output.sources = urls
    return output
```

签名不变（node, topic, language, tavily），Orchestrator 调用处无需修改。

搜索策略：
- 每个节点 **1 次搜索**，query = `{topic} {node_title} {year}`
- 不做英文补充搜索。原因：title 中通常已含英文专有名词（如"AlphaGo击败李世石"、"ChatGPT发布"），Tavily 本身就会返回中英文混合结果
- 如果未来发现纯中文 title（如"达特茅斯会议"）搜索质量差，可以追加英文搜索，但目前不做过早优化

UsageLimits：
- 当前 `UsageLimits(request_limit=8)` 可以降低，因为没有 tool call 了。纯推理只需要 1 次请求（input → output）。但保留 `request_limit=4` 作为安全网（retries 可能触发额外请求）

### 3. Milestone Agent 改造

#### 3.1 移除 tool，改为纯推理 Agent

```python
milestone_agent = Agent(
    OpenRouterModel(settings.milestone_model, provider=provider),
    output_type=MilestoneResult,
    instructions="""...""",  # 重写
    retries=2,
)
# 不再有 @milestone_agent.tool
# 不再有 deps_type=AgentDeps
```

#### 3.2 新 system prompt

```
你是 Chrono 时间线调研系统的里程碑研究专家。
你的任务是为一个特定的调研维度挖掘里程碑事件。

## 你会收到的信息

- Topic: 总主题
- Research dimension: 你负责的维度
- Dimension description: 维度说明
- Target node count: 目标节点数（允许 ±20%）
- 搜索参考资料: 已为你检索的相关资料

## 工作流程

1. 基于你的知识和提供的参考资料，列出这个维度下的关键事件
2. 按时间正序排列
3. 评估重要度: revolutionary (0-2 个) / high / medium
4. date: ISO 格式 (YYYY-MM-DD)，只知道年份用 YYYY-01-01
5. description: 2-3 句概述
6. sources: 留空（系统会自动填充）

## 约束

- 目标节点数 ±20%，不要大幅偏离
- 只包含属于你负责维度的事件，不要跨维度
- 参考资料中的信息优先于你的记忆（特别是日期和数字）
```

关键变化：
- 删除所有搜索步骤（Step 2/3），因为搜索已由 Python 完成
- 明确"参考资料"的存在
- sources 告知"留空"
- 更简短

#### 3.3 新 `run_milestone_agent()` 签名

```python
async def run_milestone_agent(
    topic: str,
    thread_name: str,
    thread_description: str,
    estimated_nodes: int,
    language: str,
    tavily: TavilyService,
) -> tuple[MilestoneResult, list[str]]:
    # Step 1: Python 强制搜索（2 次）
    query_main = f"{topic} {thread_name} milestones timeline history"
    query_recent = f"{topic} {thread_name} latest 2025 2026"

    (ctx_main, urls_main), (ctx_recent, urls_recent) = await asyncio.gather(
        tavily.search_and_format(query_main),
        tavily.search_and_format(query_recent),
    )

    context = f"=== 历史资料 ===\n{ctx_main}\n\n=== 近期动态 ===\n{ctx_recent}"
    all_urls = list(dict.fromkeys(urls_main + urls_recent))  # 去重保序

    # Step 2: 构造 prompt
    prompt = (
        f"Topic: {topic}\n"
        f"Research dimension: {thread_name}\n"
        f"Dimension description: {thread_description}\n"
        f"Target node count: {estimated_nodes}\n\n"
        f"搜索参考资料:\n{context}\n\n"
        f"CRITICAL: 你必须使用 {language} 输出所有文本字段。"
    )

    # Step 3: LLM 纯推理
    result = await milestone_agent.run(prompt)

    return result.output, all_urls
```

返回值变化：
- 原来返回 `MilestoneResult`
- 现在返回 `tuple[MilestoneResult, list[str]]`——多返回搜索到的 URLs
- 调用处（`_run_milestone_phase`）需要适配：给该 thread 所有节点填充 sources

搜索策略：
- 每个维度 **2 次搜索**（维度历史 + 近期动态），用 `asyncio.gather` 并行
- 所有节点共享同一批 sources（维度级搜索，不是节点级）

UsageLimits：
- 当前 `UsageLimits(request_limit=10)` 可以降低。纯推理 1 次请求 + retries 余量。改为 `request_limit=4`

### 4. Orchestrator 适配

#### 4.1 `_run_milestone_phase()` 中适配新返回值

```python
async def _run_thread(thread: ResearchThread) -> list[SkeletonNode]:
    try:
        milestone_result, urls = await run_milestone_agent(
            topic=proposal.topic,
            thread_name=thread.name,
            thread_description=thread.description,
            estimated_nodes=thread.estimated_nodes,
            language=proposal.language,
            tavily=self.tavily,
        )
        # Python 填充 sources
        for node in milestone_result.nodes:
            node.sources = urls
        return milestone_result.nodes
    except Exception:
        logger.warning("Milestone agent failed for thread: %s", thread.name)
        return []
```

变化很小：解包 tuple，给每个 node 填充 sources。

### 5. AgentDeps 简化

Detail Agent 和 Milestone Agent 都不再需要 `deps_type`（无 tools = 无 RunContext = 无 deps）。

`AgentDeps` 只被这两个 agent 使用。移除后 `deps.py` 可以删除。

但考虑到未来可能有其他 agent 需要 deps，保留 `deps.py` 文件但不在 detail/milestone 中使用。

实际上，检查一下：
- detail.py 当前 imports AgentDeps → 移除
- milestone.py 当前 imports AgentDeps → 移除
- 其他文件不 import AgentDeps

所以 `deps.py` 可以保留文件但变成 unused。或者直接删除，未来需要时再创建。**选择删除**——YAGNI，避免死代码。

### 6. tools.py 清理

`format_search_results()` 当前被 detail.py 和 milestone.py import。改造后两者都不再需要它（搜索格式化移入 TavilyService）。

检查其他文件是否 import tools.py：没有。**删除 tools.py**。

### 7. 搜索次数预估

| 级别 | 节点数 | Milestone 搜索 | Detail 搜索 | 总搜索次数 |
|------|--------|---------------|-------------|-----------|
| Light | 15-25 | 2 threads × 2 = 4 | 15-25 × 1 = 15-25 | ~20-29 |
| Medium | 25-45 | 3 threads × 2 = 6 | 25-45 × 1 = 25-45 | ~31-51 |
| Deep | 50-80 | 5 threads × 2 = 10 | 50-80 × 1 = 50-80 | ~60-90 |
| Epic | 80-150 | 6 threads × 2 = 12 | 80-150 × 1 = 80-150 | ~92-162 |

Tavily free tier: 1000 次/月。Deep 级每次调研 ~60-90 次，一天几次测试是够的。

如果后续搜索次数成为瓶颈，可以：
- Detail Agent 对 significance=medium 的节点跳过搜索
- 或 Detail Agent 按 batch 搜索（每 3-5 个节点共享一次搜索）

当前不做优化。

## 错误处理

- `search_and_format()` 保持纯粹——失败时抛异常，不在内部 catch
- **Detail Agent**：`run_detail_agent()` 内部 try/except 搜索调用。失败时降级为无 context 调用（`context="No search results available."`, `urls=[]`），LLM 纯靠自己知识生成 detail，只是 sources 为空。这样 Tavily 限流/超时时节点不会丢失，只是质量降低
- **Milestone Agent**：`run_milestone_agent()` 内部同样 try/except 搜索调用，失败时降级为无 context
- 外层 `_enrich_node` 和 `_run_thread` 的 try/except 仍保留，兜底 LLM 调用本身的失败

## Todo List

### Phase A: TavilyService + 清理

- [x] TavilyService 新增 `search_and_format()` 方法 ✅
- [x] 删除 `backend/app/agents/tools.py` ✅
- [x] 删除 `backend/app/agents/deps.py` ✅

### Phase B: Detail Agent 改造

- [x] 移除 `@detail_agent.tool`、`deps_type=AgentDeps`、AgentDeps import ✅
- [x] 重写 system prompt（纯推理，接收搜索参考资料） ✅
- [x] 重写 `run_detail_agent()`：Python 搜索 → context 塞 prompt → LLM 推理 → Python 填 sources ✅
- [x] 降低 `UsageLimits` 到 `request_limit=4` ✅
- [x] 搜索失败降级（try/except → 无 context 调用） ✅

### Phase C: Milestone Agent 改造

- [x] 移除 `@milestone_agent.tool`、`deps_type=AgentDeps`、AgentDeps import ✅
- [x] 重写 system prompt（纯推理，接收搜索参考资料） ✅
- [x] 重写 `run_milestone_agent()`：Python 双搜索 → context 塞 prompt → LLM 推理 → 返回 (result, urls) ✅
- [x] 降低 `UsageLimits` 到 `request_limit=4` ✅
- [x] 搜索失败降级（try/except → 无 context 调用） ✅
- [x] Orchestrator `_run_thread()` 适配新返回值，Python 填充 sources ✅

### Phase D: 验证

- [x] `ruff check && ruff format` ✅
- [x] curl "iPhone" → 16/16 details.sources 非空（每个 5 URLs），skeleton 每节点 10-20 sources ✅
- [x] curl "人工智能" → 39/39 details.sources 非空（每个 5 URLs），skeleton 每节点 10-32 sources ✅
- [x] 搜索结果被 LLM 利用（ChatGPT 节点包含"每周有超过8亿用户"等搜索数据） ✅
- [x] 完整事件流正常（skeleton → detail × N → synthesis → complete） ✅
