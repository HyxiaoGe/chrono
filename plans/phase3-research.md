# Phase 3 Research — Detail Agent 逐节点深度补充

## 1. 并发控制模式

核心场景：~20 个节点，每个跑一次 Detail Agent（LLM 调用），最多 3-5 个并行，每完成一个立即 push SSE 事件。

### asyncio.Semaphore + TaskGroup（最佳方案）

```python
sem = asyncio.Semaphore(4)

async def _process_node(node, sem, session):
    async with sem:
        try:
            result = await run_detail_agent(node)
        except Exception as exc:
            # 不 re-raise，TaskGroup 不会 cancel 其他任务
            await session.push(SSEEventType.ERROR, {...})
            return
    # push 放在 sem 外面，立即释放并发槽位
    await session.push(SSEEventType.NODE_DETAIL, {...})

async with asyncio.TaskGroup() as tg:
    for node in nodes:
        tg.create_task(_process_node(node, sem, session))
```

关键点：

- **session.push 在 `async with sem` 外面**：释放槽位后再推送，不占并发位
- **异常在 wrapper 内 catch**：TaskGroup 的默认行为是一个失败全部 cancel。必须在 wrapper 里 catch 所有异常，让 TaskGroup 只看到正常返回
- **TaskGroup 优于 gather**：client 断连时 orchestrator task 被 cancel，TaskGroup 会自动 cancel 所有子任务并正确传播 CancelledError。gather 会留下 dangling tasks
- **不需要 as_completed**：as_completed 的 for 循环是串行 await，会序列化 callback。wrapper 模式下每个 task 独立 push，天然并行

### 并发度选择

- 3-5 个并行是合理的。OpenRouter 有 rate limit，DeepSeek 端也有并发上限
- 建议默认 4，可通过配置调整
- 不需要在代码里硬编码，可以放在 Orchestrator 层面控制

## 2. Detail Agent 设计

### 输入

每个 Detail Agent 接收一个 skeleton 节点的信息（date, title, description, significance），输出该节点的深度详情。

不需要把整个 skeleton 传给每个 Detail Agent——单节点上下文就够了。topic 和 language 通过 AgentDeps 传入。

### 输出结构

参考 technical-design.md 7.1 节的 `details` 字段：

```python
class NodeDetail(BaseModel):
    key_features: list[str]   # 关键特性/要点（3-5 条）
    impact: str               # 影响和意义
    key_people: list[str]     # 关键人物
    context: str              # 背景和因果关系
    sources: list[str]        # 补充的来源 URL
```

### Prompt 设计

Milestone Agent 的 prompt 引导了 4 步工作流。Detail Agent 类似，但更聚焦于单节点深挖：

- Round 1: 基于知识生成初稿（key_features, impact, key_people, context）
- Round 2: 搜索补充事实数据
- Round 3: 交叉验证/补充背景

搜索次数控制在 1-2 次/节点（不是 4.3 节写的 5 轮——那是最终形态，当前先做轻量版）。20 节点 × 2 次 = 40 次搜索已经是上限。

### 复用模式

- 跟 Milestone Agent 一样：模块级 Agent 单例 + `run_detail_agent()` 入口函数
- 复用 `AgentDeps`（已有 tavily, topic, language）
- 复用 `@agent.tool` search 工具（可以直接复制 milestone 的 search tool，或者抽取到公共模块）

search tool 的代码在 milestone.py 和 detail.py 里完全一样。当前阶段直接复制，后续如果加第三个 agent 再抽取。

## 3. SSE 事件设计

### node_detail 事件

```json
{
    "event": "node_detail",
    "data": {
        "node_id": "ms_003",
        "details": {
            "key_features": ["...", "..."],
            "impact": "...",
            "key_people": ["...", "..."],
            "context": "...",
            "sources": ["https://...", "https://..."]
        }
    }
}
```

前端拿到 node_id 找到对应的 skeleton 节点，合并 details，节点状态从 skeleton → complete。

### progress 事件

detail phase 的 progress 事件需要更新 percent。计算方式：

```python
percent = int((completed_count / total_nodes) * 100)
```

每完成一个节点就推一次 progress。但这样会很频繁（20 次），可以考虑只在整数变化时推。

或者：不单独推 progress，让 node_detail 事件本身就隐含进度（前端可以自己算 received / total）。

建议方案：detail phase 开始时推一次 progress（"深度补充中"），然后只推 node_detail，complete 事件包含最终统计。前端根据收到的 node_detail 数量计算进度。这样更简洁。

## 4. Orchestrator 扩展

execute_research 的流程变为：

```
Phase 1: Milestone Agent → skeleton 事件
Phase 2: Detail Agent × N → node_detail × N 事件
complete 事件
```

Phase 2 是纯 asyncio 编排逻辑，不涉及 Pydantic AI 的编排层。Orchestrator 用 Semaphore + TaskGroup 控制并发，每个子任务内部调 `run_detail_agent()`。

### 进度事件时机

- Phase 1 开始：progress("skeleton", 0%)
- Phase 1 结束：skeleton 事件
- Phase 2 开始：progress("detail", 0%)
- Phase 2 每个节点完成：node_detail 事件（前端自行计算进度）
- 全部完成：complete 事件

## 5. 节点状态流转

technical-design.md 7.1 定义了三个状态：`skeleton` → `loading` → `complete`

- skeleton 事件：节点 status = "skeleton"
- detail phase 开始时：不需要单独把节点设为 loading（前端收到 detail phase 的 progress 事件后可以自行把所有 skeleton 节点标记为 loading）
- node_detail 事件：节点 status 变为 "complete"

## 6. 错误处理

单个节点的 Detail Agent 失败不应该中断整个调研。两种处理策略：

- **静默跳过**：失败的节点保持 skeleton 状态，用户看到的是部分节点有详情、部分没有
- **推送错误**：失败的节点推送 node_detail 事件但 details 为空或包含错误信息

建议静默跳过 + 日志记录。不需要给每个失败节点单独推 SSE error 事件——这会让前端处理变复杂。complete 事件里可以统计成功/失败数量。
