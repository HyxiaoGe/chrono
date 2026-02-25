# Synthesizer Agent — Research

## 1. 技术方案定位（technical-design.md §4.5）

Synthesizer 是调研流水线的最后一个 Agent，对应 Phase 4: 综合校验与定稿。职责：

- **事实交叉验证**：检查所有带具体数字的声明是否有来源支撑
- **叙事连贯性检查**：时间线是否讲了一个连贯的故事
- **重要性重新评估**：全局视角重新给每个节点评分
- **生成整体 Summary**，格式化最终输出

预计耗时 8-12 秒，使用较强模型（Sonnet 4.5）。

## 2. 模型策略（technical-design.md §5.1）

| Agent | 模型 | 理由 |
|-------|------|------|
| Synthesizer | Claude Sonnet 4.5 | 最后把关，需要强推理 |

已有 `settings.synthesizer_model = "anthropic/claude-sonnet-4.5"`，无需新增配置。

## 3. SSE 事件协议（technical-design.md §6.1）

设计文档定义了 `synthesis` 事件类型，用于推送"整体 Summary 和调研元数据"。

当前 SSE 事件流：
```
progress(skeleton) → skeleton → progress(detail) → node_detail × N → complete
```

加入 Synthesizer 后：
```
progress(skeleton) → skeleton → progress(detail) → node_detail × N → progress(synthesis) → synthesis → complete
```

## 4. 数据结构分析（technical-design.md §7.2）

技术方案定义的调研元数据字段：

- 总里程碑数量、时间跨度、调研维度数
- AI 分析次数、搜索来源数量、交叉验证点数
- 总耗时

这些元数据中，部分可由 Orchestrator 在 complete 事件中统计（total_nodes, detail_completed 已有），部分需要 Synthesizer 生成（summary, 交叉验证结果）。

## 5. 现有 Agent 模式分析

### 5.1 Agent 定义模式

所有 Agent 遵循统一模式：
- 模块级 `Agent()` 单例，`output_type` 为 Pydantic model
- `@agent.tool` 注册搜索工具
- `run_xxx_agent()` 函数作为外部调用入口
- `AgentDeps` dataclass 注入 tavily/topic/language

### 5.2 Synthesizer 的特殊性

与 Milestone/Detail Agent 不同：

1. **不需要搜索工具**：Synthesizer 基于已有数据做推理，不需要搜索新信息
2. **输入数据量大**：需要接收完整时间线（所有节点 + 详情），是其他 Agent 的输入量的 10-20 倍
3. **输出结构不同**：不是填充单个节点，而是生成全局 summary + 元数据
4. **不需要 AgentDeps**：没有搜索工具意味着不需要 tavily 依赖

### 5.3 token 预算考量

Light 级调研（~20 节点），每个节点包含 date/title/subtitle/significance/description + details(key_features/impact/key_people/context/sources)。预估输入 token：

- 骨架信息：~100 tokens/node × 20 = ~2000 tokens
- 详情信息：~200 tokens/node × 20 = ~4000 tokens
- System prompt + 格式说明：~800 tokens
- 总计：~7000 tokens 输入

Sonnet 4.5 context window 足够。但 Deep/Epic 级（50-150 nodes）需注意上限，可能需要截断策略。

## 6. 前端接收侧分析

### 6.1 当前 SSE hook

`useResearchStream.ts` 通过 `listen()` 注册命名事件监听。新增 `synthesis` 事件需要：
- 新增 `onSynthesis` callback
- 新增 `SynthesisData` TypeScript 类型

### 6.2 当前 Timeline 组件

`Timeline.tsx` 在 `completeData` 不为 null 时显示完成状态。Synthesis 数据应在 complete 之前到达，前端可将 summary 渲染在时间线底部（或顶部）。

### 6.3 ChronoApp 状态管理

新增 `synthesisData` state，在 `onSynthesis` callback 中设置，传递给 Timeline 组件显示。

## 7. Orchestrator 集成分析

当前 `execute_research()` 结构：

```python
# Phase 1: Skeleton
milestone_result = await run_milestone_agent(...)
await session.push(SSEEventType.SKELETON, ...)

# Phase 2: Detail (concurrent with TaskGroup + Semaphore)
async with asyncio.TaskGroup() as tg:
    for node in nodes:
        tg.create_task(_enrich_node(node))

# Complete
await session.push(SSEEventType.COMPLETE, ...)
```

新增 Phase 3 插入位置明确：在 TaskGroup 完成后、COMPLETE 之前。

需要注意：`_enrich_node` 中部分节点可能失败（catch + return），传给 Synthesizer 的数据应区分已补充和未补充的节点。可通过 `detail_completed` 计数或检查节点是否有 details 字段来判断。

## 8. 关键设计决策点

1. **Synthesizer 是否需要搜索能力？** → 不需要。技术方案明确说是"综合校验"，基于已有数据做推理。
2. **失败时如何处理？** → Synthesizer 失败不应阻塞整个调研。synthesis 是锦上添花，没有它 timeline 依然完整。应 catch 异常，跳过 synthesis 事件，直接发 complete。
3. **significance 重新评估是否回写节点？** → 暂不回写。Synthesizer 的评估结果放在 summary 里即可，避免 SSE 事件复杂化。后续如有需要可加 `node_update` 事件。
4. **前端 summary 放在哪里？** → 时间线底部，在 complete 状态栏上方。
