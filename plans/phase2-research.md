# Phase 2 Research — SSE + Milestone Agent + Tavily 集成

基础知识已在 Phase 1 research 文件中覆盖（pydantic-ai-research.md、sse-research.md、tavily-research.md）。本文聚焦于它们如何组合。

---

## 1. Pydantic AI 多步 Tool Use 机制

### 自动循环

Pydantic AI 的 `agent.run()` 内部自动处理多轮 tool use 循环：

```
LLM 收到 prompt + tool schemas
  → LLM 决定调用 tool A
  → Pydantic AI 执行 tool A，返回结果
  → LLM 收到 tool A 结果，决定调用 tool B
  → Pydantic AI 执行 tool B，返回结果
  → LLM 收到 tool B 结果，生成最终 structured output
```

这意味着 Milestone Agent 的四步流程可以在 **一次 `agent.run()` 调用** 中完成：
1. LLM 先用自身知识列出里程碑（不调 tool）
2. LLM 主动调用 search tool 验证日期和事实
3. LLM 调用 search tool 搜索近期信息
4. LLM 生成最终的结构化骨架输出

不需要手动编排多次 run。prompt 引导 LLM 按步骤执行即可。

### 控制机制

- **`usage_limits=UsageLimits(request_limit=N)`**：限制 LLM 请求次数（每次 tool 返回后 LLM 再次请求算一次），防止无限循环
- **`end_strategy='early'`**（默认）：LLM 一旦产出 output_type 匹配的结果就停止
- **`retries=2`**：structured output 验证失败时重试

对 Milestone Agent：设 `request_limit=15` 左右比较安全（预期 4-6 次 LLM 请求 + 4-6 次 search tool 调用）。

---

## 2. Tavily 搜索结果 → Tool 返回值格式化

Pydantic AI tool 的返回值是字符串，发给 LLM 作为 tool result。需要把 Tavily 的 JSON 响应格式化为 LLM 可消费的文本。

### Tavily 原始响应（关键字段）

```python
{
    "results": [
        {
            "title": "History of iPhone - Wikipedia",
            "url": "https://en.wikipedia.org/wiki/IPhone",
            "content": "The iPhone is a line of smartphones...",
            "score": 0.95
        },
        ...
    ],
    "answer": "The iPhone was first introduced by Steve Jobs..."  # include_answer=True 时
}
```

### 格式化方案

```python
def format_search_results(response: dict) -> str:
    parts = []
    if answer := response.get("answer"):
        parts.append(f"Summary: {answer}\n")
    for r in response.get("results", []):
        parts.append(f"- [{r['title']}]({r['url']})\n  {r['content'][:300]}")
    return "\n".join(parts)
```

要点：
- 包含 answer（如果有）作为快速摘要
- 每条结果：标题 + URL + 内容片段（截断到 300 字符控制 token 消耗）
- URL 保留，LLM 可以把它们填入 sources 字段
- score 不给 LLM 看（它不需要知道内部排序分数）

---

## 3. Session 生命周期管理

### 状态转换

```
Created → ProposalReady → Executing → Completed
                                   → Failed
```

- **Created**：`POST /api/research` 创建 session，生成 proposal
- **ProposalReady**：proposal 生成完成，等待用户确认
- **Executing**：`GET /api/research/{id}/stream` 触发，Orchestrator 开始执行
- **Completed**：Orchestrator 推送 `complete` 事件
- **Failed**：Orchestrator 出错，推送 `error` 事件

### 内存存储

当前不需要数据库，用 dict 存储即可：

```python
sessions: dict[str, ResearchSession] = {}
```

ResearchSession 需要持有：
- session_id
- proposal（Phase 0 生成的）
- queue（asyncio.Queue，SSE 桥接用）
- status（当前状态）
- orchestrator_task（asyncio.Task 引用，用于取消）

### 生命周期边界情况

1. **GET stream 在 POST 之前**：返回 404
2. **重复 GET stream**：同一个 session 只允许一个 SSE 连接（第二个返回 409）
3. **客户端断连**：sse-starlette 自动 cancel generator，通过 `client_close_handler` 做清理
4. **session 超时**：暂不实现（Phase 1 scope），后续可加定时清理

### POST 与 GET 的分离

当前 Phase 1 的 `POST /api/research` 直接返回 proposal。Phase 2 需要：
- POST 创建 session + 生成 proposal → 返回 `{session_id, proposal}`（不变）
- GET 连接 SSE 流 + 触发 Orchestrator 执行骨架构建 → 流式返回事件

这意味着 POST 不启动后台任务。后台任务在 GET 时启动——用户确认提案后才连 SSE。

---

## 4. Orchestrator ↔ Milestone Agent ↔ SSE 的协作模式

### 数据流

```
GET /api/research/{id}/stream
  │
  ▼
Orchestrator.execute_research(session)
  │
  │ 1. push progress 事件（"正在构建时间线骨架..."）
  │
  │ 2. await milestone_agent.run(topic, deps=deps)
  │    └─ LLM 内部自动循环：知识生成 → search → search → 输出
  │
  │ 3. 收到 MilestoneResult
  │
  │ 4. push skeleton 事件（骨架节点列表）
  │
  │ 5. push complete 事件
  │
  ▼
session.close()
```

关键：Orchestrator 在 asyncio 层等待 `milestone_agent.run()` 完成，然后推送 skeleton。这是同步等待（await），不是流式。骨架是一次性生成完毕后推送的——因为 Milestone Agent 需要完成所有搜索和验证后才能输出最终骨架。

### 为什么不流式推送每个节点

Phase 1（骨架构建）的特点：节点之间有依赖关系（需要去重、排序、评估重要度），所以必须等全部生成完再推送。流式推送是 Phase 2（Detail Agent）的场景——每个节点的详情可以独立生成并逐个推送。

---

## 5. Milestone Agent 的 Prompt 设计要点

Milestone Agent 的 prompt 需要引导 LLM 按 technical-design.md 4.2 节的四步流程工作：

1. **先用自身知识**：不要上来就搜索。先凭记忆列出关键里程碑。
2. **验证性搜索**：用 search tool 验证日期准确性、补充遗漏的重要事件。
3. **搜索近期信息**：专门搜索知识截止后的最新动态。
4. **定稿**：合并去重，按时间排序，评估重要度（revolutionary/high/medium）。

prompt 需要明确告诉 LLM：
- 你有 search 工具可用，但不要每个节点都搜索（成本控制）
- 先列骨架，再有针对性地搜索验证
- 搜索次数控制在 4-6 次
- 输出时确保 date 是 ISO 格式

---

## 6. SSE 事件格式

基于 technical-design.md 6.1 节，Phase 2 需要的事件类型：

| 事件类型 | data 结构 | 推送时机 |
|----------|-----------|---------|
| `progress` | `{phase, message, percent}` | 骨架构建开始时 |
| `skeleton` | `{nodes: [SkeletonNode...]}` | 骨架完成时，一次性推送所有节点 |
| `complete` | `{total_nodes, duration_seconds}` | 全部完成 |
| `error` | `{error, message}` | 出错时 |

SkeletonNode 结构（基于 technical-design.md 7.1 节）：

```python
class SkeletonNode(BaseModel):
    id: str              # 唯一标识
    date: str            # ISO 格式日期
    title: str           # 节点标题
    subtitle: str        # 副标题
    significance: str    # "revolutionary" / "high" / "medium"
    description: str     # 2-3 句概述
    sources: list[str]   # URL 列表
    status: str = "skeleton"  # 固定为 skeleton
```

---

## 7. 关键设计决策总结

1. **一次 `agent.run()` 完成四步**：不手动拆分 Milestone Agent 的步骤，靠 prompt 引导 + tool use 自动循环
2. **POST 不启动后台任务**：后台任务在 GET stream 时启动，POST 只生成 proposal
3. **骨架一次性推送**：等 Milestone Agent 完全完成后推送 skeleton 事件，不逐节点流式
4. **Tool 返回格式化文本**：Tavily JSON → 精简的 markdown 文本，控制 token 消耗
5. **Session 用内存 dict**：不需要数据库，进程重启丢失可接受
