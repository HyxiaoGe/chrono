# Milestone Agent Tuning — Research

## 1. 问题描述

对 Deep 级 topic "人工智能"，Orchestrator 的 proposal 预估 65 个节点（4 个调研维度），但 Milestone Agent 实际只生成了 6 个节点。差距超过 10 倍。

实测事件流：
```
skeleton → 6 nodes (图灵测试, 达特茅斯, 深蓝, Watson, AlphaGo, GPT-3)
node_detail × 6
synthesis → timeline_span: "1950 – 2020 (70年)"
complete → total_nodes: 6, detail_completed: 6
```

对 Light 级 topic "iPhone" 也只生成了 8 个节点（预估 ~20）。

## 2. 根因分析

### 2.1 Milestone Agent 不知道目标节点数

这是核心问题。当前 `run_milestone_agent()` 的调用：

```python
async def run_milestone_agent(topic: str, language: str, tavily: TavilyService) -> MilestoneResult:
    deps = AgentDeps(tavily=tavily, topic=topic, language=language)
    result = await milestone_agent.run(
        f"为以下主题构建时间线骨架：{topic}",
        deps=deps,
        usage_limits=UsageLimits(request_limit=15),
    )
    return result.output
```

**问题 1: Proposal 的复杂度评估没有传递给 Milestone Agent。** Orchestrator 评估了 65 个节点、4 个调研维度，但 Milestone Agent 只收到了 `topic="人工智能"` 这一个字符串。它不知道应该生成多少节点。

**问题 2: Prompt 中的节点数参考不完整。** instructions 的约束部分写了：
```
- 节点数量参考：light topic 15-25 个，medium topic 25-45 个
```
缺少 deep (50-80) 和 epic (80-150+) 的参考。而且即使写了，LLM 也不知道当前 topic 属于哪个级别。

### 2.2 LLM 的自然倾向是精简

DeepSeek V3 在结构化输出模式下，倾向于生成"最重要的几个"而非"尽可能全面"。如果 prompt 没有明确要求数量，LLM 会本能地选择质量优先、数量最少的策略。

这解释了为什么即使 prompt 说了 "15-25 个"，实际只出了 6-8 个——LLM 把那当作上限参考而非硬性要求，自行判断"这几个最重要"。

### 2.3 搜索次数不够密

对 Deep 级 topic，4-6 次搜索远不够覆盖 70 年的发展史。AI 的子领域（NLP、计算机视觉、强化学习、深度学习、生成式 AI…）每个都有独立的里程碑线索，6 次搜索只能蜻蜓点水。

### 2.4 单次调用 vs 分阶段调用

当前 Milestone Agent 是单次调用——一次 LLM 交互生成所有节点。对于 Deep/Epic 级，需要生成 50-150 个节点，一次调用很难做到：

- 输出 token 过长，LLM 可能提前截断
- 即使输出足够长，后半段的质量会下降（注意力衰减）
- DeepSeek V3 的结构化输出在大数组时不稳定

## 3. Proposal 的调研维度未被利用

Proposal 输出了 `research_threads`，例如"人工智能"的 4 个维度：

```json
[
  {"name": "核心技术演进", "priority": 5, "estimated_nodes": 25},
  {"name": "应用与产业化", "priority": 4, "estimated_nodes": 20},
  {"name": "伦理与监管", "priority": 3, "estimated_nodes": 10},
  {"name": "关键人物与机构", "priority": 3, "estimated_nodes": 10}
]
```

这些维度是 Orchestrator（Sonnet 4.5）精心规划的，但 Milestone Agent 完全没有看到它们。它只收到了 "人工智能" 三个字。

## 4. 可能的修复方向

### 方向 A: 传递目标节点数给 Milestone Agent

最简单的改动：在 `run_milestone_agent()` 中加入 `estimated_nodes` 参数，prompt 里明确告诉 LLM "你需要生成约 N 个节点"。

优点：改动小，立竿见影。
缺点：一次调用生成 50+ 节点仍然不稳定。

### 方向 B: 传递调研维度，按维度分别调用

将 `research_threads` 传给 Milestone Agent（或拆分为多次调用），每个维度独立生成节点。

例如：
- 调用 1: "核心技术演进" → 25 nodes
- 调用 2: "应用与产业化" → 20 nodes
- 调用 3: "伦理与监管" → 10 nodes
- 调用 4: "关键人物与机构" → 10 nodes

然后 Orchestrator 合并去重、按时间排序。

优点：每次调用的输出量可控，维度覆盖全面。
缺点：调用次数增加（但可并行），需要去重逻辑。

### 方向 C: A + B 结合，根据复杂度决定策略

- Light: 单次调用，传入 `estimated_nodes=20`
- Medium: 单次调用，传入 `estimated_nodes=35` + 维度提示
- Deep/Epic: 按维度拆分多次调用，每次传入该维度的 `estimated_nodes`

优点：Light 保持快速，Deep/Epic 有足够覆盖度。
缺点：Orchestrator 逻辑变复杂。

## 5. 其他观察

### 5.1 搜索结果未被充分利用

"人工智能" 的 skeleton 中所有节点的 `sources` 都为空列表 `[]`。说明 Milestone Agent 要么没搜索，要么搜了但没有把结果整合进 sources 字段。从 6 个节点且全无来源来看，很可能 Agent 只执行了 Step 1（自身知识）就直接输出了，跳过了 Step 2-3 的搜索。

这可能是因为 DeepSeek V3 在结构化输出模式下不稳定地执行工具调用。需要确认 `request_limit=15` 是否真正允许了多轮交互。

### 5.2 时间线覆盖度差

6 个节点覆盖 1950-2020，完全遗漏了：
- 1960-1970s AI 第一次寒冬
- 1980s 专家系统兴起
- 1986 反向传播算法
- 2012 AlexNet / ImageNet 突破
- 2017 Transformer 架构（Attention Is All You Need）
- 2022 ChatGPT
- 2023 GPT-4
- 2024-2025 开源模型爆发（Llama, Mistral, DeepSeek）

这些都是"人工智能"主题不可遗漏的里程碑。
