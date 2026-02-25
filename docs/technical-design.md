# CHRONO — Multi-Agent Timeline Research System

**技术方案文档 v1.0 / Technical Design Document**

2025年2月

---

## 目录 / Table of Contents

1. [项目概述 / Project Overview](#1-项目概述--project-overview)
2. [系统架构 / System Architecture](#2-系统架构--system-architecture)
3. [Orchestrator 设计](#3-orchestrator-设计)
4. [调研流程 / Research Pipeline](#4-调研流程--research-pipeline)
5. [LLM 策略 / Model Strategy](#5-llm-策略--model-strategy)
6. [前端设计 / Frontend Design](#6-前端设计--frontend-design)
7. [数据结构 / Data Structure](#7-数据结构--data-structure)
8. [Epic 级调研策略](#8-epic-级调研策略)
9. [下一步计划 / Next Steps](#9-下一步计划--next-steps)

---

## 1. 项目概述 / Project Overview

### 1.1 产品定位

Chrono 是一个基于 Multi-Agent AI 的时间线调研系统。用户输入任意关键词（产品、技术、文化、历史事件等），系统自动调研其发展历程，生成一条结构化的交互式 Timeline。

> **核心价值主张**
>
> "把原本需要几小时的调研工作压缩到几分钟，并以可视化的时间轴形式呈现。"

### 1.2 核心体验流程

**用户输入关键词** → **Orchestrator 评估复杂度、生成调研提案** → **用户确认** → **多 Agent 并行执行调研** → **渐进式渲染 Timeline**

- 用户输入后，Orchestrator 先评估 topic 复杂度，生成调研提案（预计时间、额度消耗、调研维度）
- 用户可调整调研范围（勾选/取消维度），确认后开始执行
- 执行过程中通过 SSE 实时推送进度，前端渐进式渲染
- 骨架先出现，节点逐步填充内容，用户可边浏览边等待

### 1.3 复杂度分级

| 等级 | 示例 | 预计时间 | 节点数 | LLM 调用 | 额度 |
|------|------|----------|--------|----------|------|
| **Light** | iPhone, React | 1.5-3 分钟 | 15-25 | 50-80 | 1 |
| **Medium** | 微信, 比特币 | 3-4 分钟 | 25-45 | 80-120 | 2 |
| **Deep** | 互联网史, 冷战 | 4-6 分钟 | 50-80 | 120-160 | 3 |
| **Epic** | 二战, 人类航天 | 5-8 分钟 | 80-150+ | 160-220 | 5 |

复杂度由 Orchestrator 自主评估，不由系统硬编码。时间和资源消耗随 topic 类型动态调整。

---

## 2. 系统架构 / System Architecture

### 2.1 技术栈总览

| 层级 | 技术选型 | 说明 |
|------|----------|------|
| **前端** | Next.js + React | 纵向时间轴，上下滚动 |
| **后端 Web 框架** | FastAPI (Python) | SSE 流式推送 |
| **顶层编排** | Python asyncio | 全程在线的 Orchestrator |
| **子 Agent 实现** | Pydantic AI | 类型安全的结构化输出 |
| **LLM 网关** | OpenRouter | 统一接入多模型，一个 API Key |
| **搜索** | Tavily | 专为 AI Agent 设计的搜索 API |
| **前后端通信** | SSE (Server-Sent Events) | 实时流式推送进度和数据 |
| **部署** | Vercel + Railway/Fly.io | 前端 Vercel，后端 Railway/Fly.io |

### 2.2 整体数据流

系统的数据流分为两个阶段：调研提案阶段（同步）和调研执行阶段（流式）。

**阶段一：调研提案（同步）**

- Browser 发送 `POST /research` 请求，携带 topic 和语言信息
- Orchestrator 接收输入，评估复杂度，生成调研提案
- 返回提案给前端，用户确认或调整调研范围

**阶段二：调研执行（SSE 流式）**

- 用户确认后，后端开始 SSE 流式推送
- Orchestrator 全程监控，动态调度子 Agent，每完成一个节点即推送前端
- 前端接收 SSE 事件，渐进式渲染 Timeline

### 2.3 架构选型决策记录

#### 2.3.1 为什么不用 LangGraph

最初考虑使用 LangGraph（图状态机）做全局编排，但经过讨论发现架构已从"固定 DAG 流水线"演变为"事件驱动的动态系统"。LangGraph 的图在编译时定义，运行时修改图结构不自然。而我们需要 Orchestrator 全程在线监控、动态增删调研线索、资源动态再分配等能力。

#### 2.3.2 为什么不用 CrewAI

CrewAI 适合"制定好计划然后按部就班执行"的场景。但本系统需要"边执行边调整计划"，流式输出支持弱，并行控制粒度不够，Orchestrator 全程在线监控也不支持。

#### 2.3.3 最终方案：Python async + Pydantic AI

- **顶层编排**用纯 Python asyncio，完全掌控 Orchestrator 的生命周期和动态调度
- **子 Agent 内部**用 Pydantic AI，提供类型安全的结构化输入输出和工具调用封装
- 两层职责完全分离：asyncio 管"谁先跑谁后跑"，Pydantic AI 管"每个 Agent 怎么跟 LLM 交互"

---

## 3. Orchestrator 设计

### 3.1 角色定位

Orchestrator 不是一个"开头分配完任务就消失的调度器"，而是一个**全程在线的项目经理**。它的职责贯穿调研全过程：

- **初始评估**：理解用户输入，评估 topic 复杂度，生成调研提案
- **资源规划**：决定需要多少子 Agent、多少搜索预算、多长时间
- **任务调度**：动态 spawn/cancel 子 Agent，分配任务
- **实时监控**：接收子 Agent 回报，评估进度，推送前端
- **动态调整**：根据实际情况调整调研计划（新增/取消线索、调整时间预估）
- **质量把关**：最终校验和定稿

### 3.2 Orchestrator 输出结构（调研提案）

Orchestrator 评估完成后，输出一份结构化的调研提案，包含以下关键字段：

- `topic`: 用户输入的关键词
- `type`: 类型判断（product / technology / culture / historical_event）
- `complexity_assessment`: 复杂度评估（时间跨度、并行线索数、预估节点数等）
- `research_threads`: 调研维度列表，每条带优先级和预估节点数
- `estimated_total_duration`: 预计总时长
- `user_facing`: 给前端展示的用户友好版本

### 3.3 动态调整场景

- **某线索信息不足**：减少该方向投入，资源调配给其他线索
- **某线索比预期复杂**：增加调研深度，可能延长总时间
- **发现意料之外的重要线索**：在预算允许时动态新增
- **搜索 API 限流或模型响应慢**：降低并行度，延长时间预估并通知前端

---

## 4. 调研流程 / Research Pipeline

### 4.1 Phase 0: 输入理解与增强

用户只输入简短关键词，Orchestrator 需要明确调研范围。关键特点：**先用模型自身知识储备建立框架**，而不是上来就搜索。搜索是为了补充、验证、更新，不是从零开始。

> 预计耗时：5-8 秒，2-3 次 LLM 调用，不涉及搜索。

### 4.2 Phase 1: 知识骨架构建

Milestone Agent 的工作分四步：

1. **Step 1**：基于模型自身知识先列出已知的里程碑（不搜索）
2. **Step 2**：针对骨架做验证性搜索，修正日期错误、补充遗漏节点
3. **Step 3**：搜索近期信息（模型知识截止后的最新动态）
4. **Step 4**：骨架定稿，合并去重，按时间排序，评估重要度

> 预计耗时：10-15 秒，4-6 次 LLM 调用，4-6 次搜索。骨架完成后立即推送前端。

### 4.3 Phase 2: 深度细节补充

每个里程碑的 Detail Agent 进行多轮深挖：

1. **Round 1**：基于自身知识生成初稿
2. **Round 2**：搜索补充事实数据（具体数字、日期、人物）
3. **Round 3**：搜索背景故事和因果关系
4. **Round 4**：搜索影响和后续发展
5. **Round 5**：交叉验证，对比多个来源确认数据一致性

各 milestone 分 batch 并行处理，每完成一个即通过 SSE 推送前端填充。

> 预计耗时：30-60 秒，是时间和成本的大头。

### 4.4 Phase 3: 关联分析与补盲

- 审视整条时间线，发现信息空白（某个时间段缺失事件）
- 建立事件之间的因果关系（需要 LLM 的推理能力）
- 添加外部背景线（宏观数据、行业背景）
- 竞品/参照对比（同期其他产品/事件在做什么）

> 预计耗时：15-25 秒。

### 4.5 Phase 4: 综合校验与定稿

- **事实交叉验证**：检查所有带具体数字的声明是否有来源支撑
- **叙事连贯性检查**：时间线是否讲了一个连贯的故事
- **重要性重新评估**：全局视角重新给每个节点评分
- 生成整体 Summary，格式化最终输出

> 预计耗时：8-12 秒。使用较强的模型（Sonnet 4.5）做质量把关。

---

## 5. LLM 策略 / Model Strategy

### 5.1 多模型混用策略

不同 Agent 的智力需求差异很大，采用"**Sonnet 做大脑，便宜模型做四肢**"的策略：

| Agent | 默认模型 | 调用次数 | 理由 |
|-------|----------|----------|------|
| **Orchestrator** | Claude Sonnet 4.5 | 2-3 | 需要强理解力做策略规划 |
| **Milestone Agent** | DeepSeek V3.2 | 4-6 | 结构化提取，性价比优先 |
| **Detail Agent ×N** | DeepSeek V3.2 | 30-50 | 调用最多，成本敏感 |
| **Impact Agent** | DeepSeek V3.2 | 5-8 | 归纳分析任务 |
| **Synthesizer** | Claude Sonnet 4.5 | 2-3 | 最后把关，需要强推理 |

### 5.2 语言感知的模型路由

不同语言的用户输入会触发不同的模型路由策略，因为模型对不同语言的处理能力差异显著：

| 语言 | 编排/把关层 | 执行层 | 理由 |
|------|-------------|--------|------|
| **中文** | Sonnet 4.5 / DeepSeek | DeepSeek V3.2 | DeepSeek 中文最强 |
| **英文** | Claude Sonnet 4.5 | DeepSeek V3.2 | 标准方案 |
| **日文** | Gemini 2.5 Pro / GPT-4o | Gemini 2.5 Flash | Gemini/GPT 日文更好 |
| **其他** | Claude Sonnet 4.5 | GPT-4o-mini | 安全默认选择 |

所有模型通过 OpenRouter 统一调用，切换模型只需改一个字符串，零代码改动。

### 5.3 搜索策略

采用混合搜索方案：Tavily 作为独立搜索层，但通过 tool use 让 LLM 也能主动触发搜索。中间加一层缓存和限流。

**搜索语言策略**：主语言（用户语言）为主 + 英文补充（英文互联网信息密度最高）。如果 topic 有明确的文化归属，追加原产地语言。

### 5.4 成本估算

| 复杂度 | LLM 成本 | Tavily 成本 | 合计 | 额度 |
|--------|----------|-------------|------|------|
| **Light** | ~$0.25 | ~$0.03 | ~$0.28 | 1 |
| **Medium** | ~$0.45 | ~$0.05 | ~$0.50 | 2 |
| **Deep** | ~$0.90 | ~$0.10 | ~$1.00 | 3 |
| **Epic** | ~$1.80 | ~$0.15 | ~$2.00 | 5 |

**成本优化手段**：
- **Prompt Caching**：缓存重复的 system prompt，省 90%
- **Batch API**：预生成热门 topic，省 50%
- **结果缓存**：缓存已调研的 topic，避免重复消耗

---

## 6. 前端设计 / Frontend Design

### 6.1 SSE 事件协议

前后端通过 SSE 通信，定义以下事件类型：

| 事件类型 | 说明 |
|----------|------|
| `agent_status` | 某个 Agent 状态变化（running/done/error） |
| `skeleton` | 时间轴骨架数据（里程碑列表，含时间/标题/重要度） |
| `node_detail` | 单个节点的完整数据（描述、特性、影响、来源） |
| `node_enrichment` | 对已有节点的补充信息（影响力分析、竞品对照） |
| `progress` | 进度更新（当前正在做什么、完成比例、时间预估调整） |
| `synthesis` | 整体 Summary 和调研元数据 |
| `complete` | 调研全部完成 |

### 6.2 前端渲染策略

Timeline 采用纵向时间轴（上下滚动），左右交替排列卡片。核心体验是**渐进式渲染**：

- `skeleton` 事件 → 骨架出现，节点显示 shimmer 加载动画
- `node_detail` 事件 → 对应节点从 shimmer 变为完整内容，带入场动画
- `progress` 事件 → 更新顶部进度条和状态文字
- 用户可在加载过程中就开始浏览和交互（点击展开已完成的节点）

### 6.3 确认界面设计

Orchestrator 评估完成后，展示调研提案确认界面，包含：

- Topic 识别结果和时间范围
- 调研维度列表（可勾选/取消）
- 预计时间和节点数
- 额度消耗和剩余额度
- "开始调研" / "取消" 按钮

参考视频生成场景的确认模式，让用户有明确的预期管理和控制权。

---

## 7. 数据结构 / Data Structure

### 7.1 Timeline 节点数据结构

每个 Timeline 节点包含以下字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 唯一标识符 |
| `date` | string | 日期，ISO 格式 |
| `title` | string | 节点标题 |
| `subtitle` | string | 副标题（如产品名称） |
| `significance` | enum | `revolutionary` / `high` / `medium` |
| `description` | string | 2-3 句概述 |
| `details` | object | 包含 key_features, impact, price, key_people 等 |
| `sources` | string[] | 信息来源 URL 列表 |
| `status` | enum | `skeleton` / `loading` / `complete` |

### 7.2 调研元数据

调研完成后，底部展示调研元数据以建立信任感：

- 总里程碑数量、时间跨度、调研维度数
- AI 分析次数、搜索来源数量、交叉验证点数
- 总耗时

---

## 8. Epic 级调研策略

对于"二战"这类超大规模的 topic，需要专门的策略：

### 8.1 分阶段 + 多线程 + 分层

1. **Step 1: 分阶段** — Orchestrator 将时间线拆分为多个历史阶段（如二战拆为前因/开战/转折/反攻/终结五个阶段）
2. **Step 2: 并行调研** — 每个阶段分配独立的子 Agent 集群，5 个阶段可并行跑
3. **Step 3: 阶段内分线索** — 每个阶段内部再分军事/政治/人物等线索
4. **Step 4: 跨阶段关联** — 合并 5 个阶段的输出，建立跨阶段因果链
5. **Step 5: 选择性深挖** — 从 100+ 节点中选 20 个最关键的做深度调研

### 8.2 资源分配原则

Epic 级调研节点多，不可能每个都深入调研。采用"**广度优先 + 选择性深挖**"策略：先铺广度覆盖所有重要事件，然后识别 turning point 做重点深入，其余节点保持概要级别。

---

## 9. 下一步计划 / Next Steps

### 9.1 开发路线图

**Phase 1: 后端骨架（当前优先级）**

- FastAPI + SSE 基础设施
- Orchestrator 核心逻辑（评估 + 调度 + 监控）
- Pydantic AI 子 Agent 模板
- OpenRouter + Tavily 集成

**Phase 2: 前后端对接**

- SSE 协议落地到前端原型
- 确认界面 + 进度反馈 UI
- 渐进式渲染逻辑

**Phase 3: 调研深度优化**

- 各 Agent 的 prompt 迭代优化
- 多语言路由测试
- Epic 级调研策略实现

**Phase 4: 产品化**

- 用户系统 + 额度管理
- 调研结果缓存
- 部署上线

### 9.2 待确认事项

- 数据库选型（是否缓存已调研的 topic）
- 用户系统设计
- 额度系统具体方案（免费/付费分层）
- 部署方案确认
- 产品名称确认（Chrono 为暂定）

---

*— End of Document —*
