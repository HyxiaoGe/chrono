# Backend Runtime Refactor Research

## 背景

本轮重构目标不是新增产品能力，而是在保持现有 API、SSE 协议、DB replay、缓存和多 Agent 行为兼容的前提下，降低后端编排层的复杂度，为后续继续演进多 Agent 架构打基础。

## 当前实现结论

### 1. 编排层过胖

`backend/app/orchestrator/orchestrator.py` 当前同时承担：

- proposal 搜索增强与提案生成
- milestone 并发调度
- dedup 三层处理
- detail fan-out 与模型池轮询
- hallucination filter 与历史 spot-check
- gap node 补充与 connections 生成
- synthesis 与 date correction
- SSE payload 组装
- DB 落库与 Redis session 状态更新

这说明 `Orchestrator` 已经不是单纯的调度器，而是兼任多个 phase service 的实现体。

### 2. 运行时节点中间态弱类型

虽然 agent 输出与 proposal/synthesis 等边界数据已经使用 Pydantic model，但 orchestrator 中段仍大量使用 `list[dict]` 传递节点。

目前运行时节点实际承载的字段包括：

- `id`
- `date`
- `title`
- `subtitle`
- `significance`
- `description`
- `sources`
- `status`
- `details`
- `phase_name`
- `is_gap_node`

这些字段在不同 phase 被原地增删改，缺少统一类型定义，容易在重构时漏掉字段传播。

### 3. Session 状态分散

当前 session 生命周期横跨：

- `backend/app/main.py`
- `backend/app/models/session.py`
- `backend/app/db/redis.py`
- `backend/app/db/replay.py`

内存 session、Redis session snapshot、DB completed research 共同决定 `/status` 与 `/stream` 的行为，但入口判断没有统一收敛。

特别是冷启动后仅靠 Redis 恢复时，Redis 中的状态与新建 `ResearchSession` 的默认状态可能不一致。

### 4. 现有可靠性能力必须保留

已有计划和代码中这些能力已经落地，本轮不能回退：

- `plans/session-lifecycle-plan.md`：SSE history + reconnect
- `plans/p2-pipeline-hardening-plan.md`：Phase 2 checkpoint、Phase 3 fallback
- `plans/phase3-gap-analysis-plan.md`：analysis phase、gap integration、connections
- `plans/similar-topic-plan.md`：similar topic 分支

## 重构原则

### 1. 外部契约不变

以下内容必须保持兼容：

- API 路径与响应结构
- SSE 事件类型与 payload 形状
- DB replay 顺序
- Redis proposal/session cache 语义
- gap node、hallucination filter、date correction 的用户可见行为

### 2. 先引入新结构，再迁移旧逻辑

不能一次性把 orchestrator 全部推翻。更稳妥的方式是：

1. 先定义运行时强类型模型
2. 再把纯逻辑拆成模块
3. 再让总 orchestrator 串联新模块
4. 最后再收口 session lifecycle

### 3. 保留现有 agent 职责边界

顶层编排仍然由 asyncio 负责，子 Agent 仍只负责单一任务的结构化输出，不把编排逻辑塞回 Pydantic AI agent 内部。

## 建议模块拆分

建议新增以下模块：

- `backend/app/models/runtime.py`
- `backend/app/orchestrator/proposal.py`
- `backend/app/orchestrator/dedup.py`
- `backend/app/orchestrator/verification.py`
- `backend/app/orchestrator/event_publisher.py`
- `backend/app/orchestrator/phases/skeleton.py`
- `backend/app/orchestrator/phases/detail.py`
- `backend/app/orchestrator/phases/analysis.py`
- `backend/app/orchestrator/phases/synthesis.py`
- `backend/app/session/lifecycle.py`

## 最小运行时模型

### `RuntimeTimelineNode`

最小字段集合：

- `id`
- `date`
- `title`
- `subtitle`
- `significance`
- `description`
- `sources`
- `status`
- `details`
- `phase_name`
- `is_gap_node`

### `RuntimeResearchState`

最小字段集合：

- `proposal`
- `nodes`
- `detail_contexts`
- `gap_connections`
- `synthesis_data`
- `detail_completed`

## 回归高风险点

需要特别保护的逻辑：

- dedup 三层顺序与合并策略
- gap node ID 分配与排序
- date correction 后的重新排序与 skeleton 重推
- DB replay 输出顺序
- reconnect / replay / first connect 的 session 路径分叉
- phase 3 failure fallback 到 phase2 snapshot

## 实施顺序

1. 建立 research 文档并与历史计划对齐
2. 引入运行时模型与转换函数
3. 抽离 dedup / verification / proposal
4. 抽离 skeleton / detail / analysis / synthesis phase service
5. 收口 session lifecycle
6. 用新模块替换旧 orchestrator 主链路
7. 完成 ruff / build / 关键路径回归验证
