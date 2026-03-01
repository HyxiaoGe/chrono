# Epic 策略设计分析

## 问题陈述

当前 pipeline 对所有复杂度级别执行相同的流程：

```
Phase 0: Orchestrator 拆出 research_threads（维度列表）
Phase 1: 每个 thread 一个 Milestone Agent 并行 → 汇总去重
Phase 2-4: Detail → Hallucination Filter → Gap Analysis → Synthesis
```

这对 light/medium/deep 够用，但对 epic 级 topic 有三个根本性问题：

**问题 1：单个 Milestone Agent 负担过重**

"二战"的"军事进程"维度，一个 Milestone Agent 要在一次调用中列出从闪电战到诺曼底登陆到柏林战役的所有里程碑。LLM 在单次调用中能稳定输出的结构化节点数有上限（大约 20-30 个），超过这个数就会开始遗漏或质量下降。

**问题 2：跨维度重复爆炸**

"二战"拆成"军事进程""政治外交""关键人物"三个维度，珍珠港事件会在三个维度里都出现。维度越多、时间跨度越大，重复越严重。当前的 LLM 去重在 50+ 节点时效果已经开始下降（"人工智能" 45 节点就出现了 Transformer 重复）。

**问题 3：缺少叙事层次**

150 个节点平铺在一条时间线上，即使每个节点质量很高，整体也缺乏"故事感"。用户很难从一堆孤立事件中看出阶段性的大脉络。

## 解决方案：分阶段调研

核心思路：**在维度拆分之前，先按时间/主题做阶段拆分**。每个阶段是一个独立的、范围受限的调研单元。

### 当前流程（light/medium/deep）

```
"人工智能"
  → Orchestrator 拆维度:
      [技术演进, 产业应用, 伦理监管, 关键人物]
  → 4 个 Milestone Agent 并行，每个覆盖全时间线
  → 汇总 → 去重 → Detail → ...
```

### Epic 流程

```
"二战"
  → Orchestrator 先拆阶段:
      Phase A: 战前酝酿 (1933-1939)
      Phase B: 闪电战与扩张 (1939-1941)
      Phase C: 全球化与转折 (1941-1943)
      Phase D: 反攻与终结 (1943-1945)
      Phase E: 战后清算 (1945-1947)
  → 每个阶段内再拆维度:
      Phase A: [政治博弈, 军事准备]  → 2 个 Milestone Agent
      Phase B: [军事进程, 政治外交]  → 2 个 Milestone Agent
      ...
  → 阶段内去重 → 跨阶段全局去重 → 统一进入 Detail → ...
```

### 三个问题怎么解决的

**问题 1 → 每个 Milestone Agent 只负责一个阶段的一个维度**。比如 Phase B 的"军事进程"只需要列出 1939-1941 年间的军事事件（闪电战、敦刻尔克、法国投降、不列颠之战），大约 5-8 个节点，完全在 LLM 单次调用的舒适区内。

**问题 2 → 阶段的时间范围天然隔离**。"珍珠港"只会出现在 Phase C（1941-1943），不会跑到 Phase B（1939-1941）。不同阶段的 Milestone Agent 工作在不重叠的时间段上，跨阶段重复率极低。阶段内的重复用现有去重逻辑就能处理（同阶段内维度数少，去重压力小）。

**问题 3 → 阶段结构本身就是叙事层次**。Synthesizer 拿到的不是 150 个平铺节点，而是"5 个阶段、每阶段 20-30 个节点"的结构化输入，天然能生成分章节的叙事。

## 对 deep 级的影响

答案是**可以受益**。"人工智能"当前被判定为 deep（4 维度、50-80 节点），如果加上阶段拆分：

```
"人工智能"（deep + 分阶段）
  → Phase A: 萌芽期 (1943-1980)     → [理论突破, 早期应用]
  → Phase B: 寒冬与复苏 (1980-2006) → [技术路线, 产业尝试]
  → Phase C: 深度学习崛起 (2006-2017) → [技术突破, 商业化]
  → Phase D: 大模型时代 (2017-2025)  → [模型迭代, 伦理监管]
```

Transformer 就只会出现在 Phase C 里，阶段内去重轻松搞定。

**但不应该对所有 deep 都强制分阶段。** 建议策略：
- **light / medium**：不分阶段，走现有流程
- **deep**：Orchestrator 自主判断是否需要分阶段（在 prompt 中给 LLM 判断标准）
- **epic**：必须分阶段

## 架构设计

### 数据结构变更

```python
# 新增
class ResearchPhase(BaseModel):
    name: str                        # "战前酝酿"
    time_range: str                  # "1933-1939"
    description: str                 # 该阶段的调研重点说明
    threads: list[ResearchThread]    # 该阶段内的维度列表

# 修改 ResearchProposal
class ResearchProposal(BaseModel):
    # ... 现有字段全部保留 ...
    research_threads: list[ResearchThread]    # light/medium 用这个
    research_phases: list[ResearchPhase] = [] # 新增，epic/deep可选
```

**向后兼容**：`research_phases` 默认空列表。当它为空时，pipeline 走现有逻辑（用 `research_threads`）；当它非空时，走分阶段逻辑（忽略顶层 `research_threads`，用每个 phase 内的 `threads`）。

### Phase 0 变更：Orchestrator Prompt

Orchestrator 的 prompt 需要扩展，让 LLM 在判定为 epic（或需要分阶段的 deep）时额外输出 `research_phases`。

判断标准（给 LLM 的指引）：
- 时间跨度 > 30 年 + 存在明显的阶段性转折 → 适合分阶段
- 时间跨度短但信息密度高、线性发展 → 不适合分阶段
- epic 级必须分阶段
- 每个阶段 15-30 个节点，阶段数 3-6 个
- 每个阶段内的维度数 2-3 个（比顶层维度少，因为范围更聚焦）
- 阶段间的时间范围不能重叠（避免重复）

### Phase 1 变更：两层并行

```
无阶段（research_phases 为空）:
    现有逻辑不变
    TaskGroup: [Thread_A, Thread_B, Thread_C, Thread_D] 并行
    → 合并去重

有阶段（research_phases 非空）:
    外层 TaskGroup: [Phase_A, Phase_B, Phase_C, Phase_D, Phase_E] 并行
        每个 Phase 内部:
            内层 TaskGroup: [Thread_1, Thread_2] 并行
            → 阶段内去重
    → 跨阶段全局去重
```

所有阶段并行执行（不串行），因为时间范围不重叠，重复率低。

**并发量估算**：epic 5 个阶段 × 每阶段 2-3 个维度 = 10-15 个 Milestone Agent 同时跑。需要加一个 Semaphore 限制总并发（比如 8），避免 API rate limit。

### Phase 2-4：几乎不变

分阶段的产出最终还是一个**扁平的节点列表**。Phase 2 的 Detail Agent、Phase 3 的 Hallucination Filter 和 Gap Analysis、Phase 4 的 Synthesizer 都操作扁平节点列表，不需要知道节点来自哪个阶段。

**唯一的变化**是 Synthesizer：如果把阶段信息传给 Synthesizer（哪些节点属于哪个阶段），它可以生成分章节的叙事。v1 可以不传阶段信息；v2 再加分章节叙事。

### SSE 事件流变更

对前端完全透明。分阶段只影响 Phase 1 内部的执行逻辑，SSE 推出来的事件格式不变。前端不感知后端是分阶段跑的还是直接跑的。

### 节点归属标记（可选）

在节点 dict 中加一个可选字段 `phase_name`，标记该节点来自哪个阶段。v1 不用于任何逻辑，纯粹是元数据。

## 改动影响评估

| 组件 | 改动程度 | 说明 |
|------|---------|------|
| `models/research.py` | 小 | 新增 `ResearchPhase` model，`ResearchProposal` 加一个字段 |
| Orchestrator Prompt | 中 | 扩展 prompt 让 LLM 输出 `research_phases` |
| `orchestrator.py` Phase 1 | 中 | `_run_milestone_phase()` 方法需要处理两层并行 + 两层去重 |
| `orchestrator.py` Phase 2-4 | 无 | 完全不变，操作扁平节点列表 |
| Milestone Agent | 无 | 不变 |
| Detail Agent | 无 | 不变 |
| Hallucination Filter | 无 | 不变 |
| Gap Analysis | 无 | 不变 |
| Synthesizer | 无（v1）/ 小（v2） | v1 不变 |
| 前端 | 无 | SSE 事件格式不变 |
| 数据库 | 小 | `timeline_nodes` 表可加 `phase_name` 可选列 |

## 风险点

1. **LLM 阶段拆分质量**：Orchestrator 需要对 topic 有足够理解才能拆出合理的阶段。缓解：允许阶段间有少量时间重叠 buffer，靠跨阶段去重处理。
2. **并发量翻倍**：epic 的 Milestone 并发从 4-6 跳到 10-15。缓解：加 Semaphore 限制全局 Milestone 并发数。
3. **跨阶段去重的复杂度**：跨阶段重复率应该很低，但不是零。需要在阶段内去重之后，再做一轮全局去重。
4. **Orchestrator Prompt 膨胀**：加入阶段拆分的指引后 prompt 会变长，注意不要超过模型的有效指令跟随长度。

## 实施计划

### v1：Epic 基础能力
- 数据结构：新增 ResearchPhase
- Orchestrator Prompt：扩展支持 research_phases 输出
- Phase 1：两层并行 + 两层去重
- 验证：用"二战"测试 epic 完整流程

### v2：Deep 级可选分阶段 + Synthesizer 分章节叙事
- Orchestrator Prompt：让 LLM 对 deep 级也可选输出 research_phases
- Synthesizer：接收阶段信息，生成分章节 summary
- 前端：可选按阶段分组展示
- 验证：用"人工智能"对比分阶段 vs 不分阶段的效果差异

## Todo List

### v1 子任务

- [x] 1. `models/research.py`: 新增 `ResearchPhase` model，`ResearchProposal` 加 `research_phases: list[ResearchPhase] = []` 字段
- [x] 2. `orchestrator.py`: 扩展 `_proposal_agent` 的 system prompt，加入阶段拆分指引和示例
- [x] 3. `orchestrator.py`: 重构 `_run_milestone_phase()`，支持两层并行（phases → threads）+ 阶段内去重 + 跨阶段全局去重
- [x] 4. `orchestrator.py`: 在节点 dict 中加 `phase_name` 可选字段
- [x] 5. `orchestrator.py`: 模块级常量 `_MILESTONE_CONCURRENCY = 8`，控制 Milestone Agent 全局并发
- [x] 6. `db/models.py`: `TimelineNodeRow` 加 `phase_name` 可选列 + alembic migration
- [ ] 7. E2E 测试："二战" epic 完整流程，验证阶段拆分 → 两层并行 → 去重 → Detail → Synthesis
- [ ] 8. 对比测试：同一 topic 分阶段 vs 不分阶段的节点质量和重复率
