# Chrono Refactor Readiness Research

## 背景

用户想在近期重构 Chrono。当前阶段只做项目熟悉和 Research，不写实现代码。

本研究文档的目标是回答三个问题：

1. 当前真实架构是什么，而不是只看早期设计文档。
2. 上一轮后端 runtime refactor 已经完成了哪些拆分。
3. 下一轮重构最应该先保护哪些契约和基线。

## 已阅读材料

- `AGENTS.md`
- `CLAUDE.md`
- `docs/technical-design.md`
- `docs/ARCHITECTURE_RULES.md`
- `docs/CODING_CONVENTIONS.md`
- `plans/backend-runtime-refactor-research.md`
- `plans/session-lifecycle-plan.md`
- `plans/sse-research.md`
- `plans/frontend-research.md`
- 后端入口、orchestrator、phase、agent、session、SSE、DB、Redis 相关代码
- 前端 session 页面、SSE hook、timeline、detail panel、类型定义、Next rewrites 配置

## 当前系统地图

### 后端入口与缓存层

主入口是 `backend/app/main.py`。

`POST /api/research` 当前有四层决策：

1. DB completed research cache：命中后创建 session，并通过 DB replay 输出完整 SSE 流。
2. LLM similar topic detection：对已有 topic 做语义相似匹配，返回 `similar_topic` 分支。
3. Redis proposal cache：复用已生成但未执行的 proposal。
4. Fresh proposal：调用 orchestrator 生成新 proposal，并写 Redis proposal/session。

`GET /api/research/{session_id}/status` 与 `GET /api/research/{session_id}/stream` 已经下沉到 `SessionLifecycleService`，入口层相对干净。

### 后端执行管道

执行入口是 `Orchestrator.execute_research()`，现在已经是较薄的顺序编排器：

1. `build_skeleton_phase()`
2. `run_detail_phase()`
3. `run_analysis_phase()`
4. `run_synthesis_phase()`
5. `save_research()`

Phase 3 有 checkpoint/fallback：detail 完成后复制 `phase2_snapshot`，analysis 失败时回退到 Phase 2 snapshot 并重新推 skeleton。

Synthesis 失败时会跳过 summary，但仍 complete 并尝试持久化。

### Runtime model

上一轮重构已经引入：

- `RuntimeTimelineNode`
- `RuntimeResearchState`

这解决了旧文档里提到的中间态 `list[dict]` 弱类型问题。当前关键字段包括：

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

`RuntimeTimelineNode.to_sse_dict()` 同时服务 SSE payload 与 DB dict，因此它是后端输出契约的核心边界。

### Agent 层

Agent 仍维持“子任务结构化输出”的职责：

- `milestone.py`：单 research dimension 的 skeleton 节点发现。
- `detail.py`：单节点详情补充。
- `gap_analysis.py`：补盲节点与 causal connections。
- `synthesizer.py`：最终 summary、date correction、verification notes。
- `similar_topic.py`：已有 topic 语义复用判断。

这一点符合架构约束：asyncio 管编排，Pydantic AI agent 管单任务结构化输出。

### SSE 与 session

后端 SSE payload 统一由 `backend/app/sse/event_publisher.py` 推送。

`ResearchSession` 维护：

- live queue
- append-only `_event_history`
- `event_generator()`
- `replay_and_stream()`

`SessionLifecycleService` 负责：

- 从内存 session 获取
- 从 Redis session 恢复
- reconcile cached DB research
- first-connect start
- executing/completed reconnect replay
- cached research DB replay

这块是用户体验高风险边界，重构时必须有测试保护。

### 持久化与 replay

完成后的 research 存在 Postgres：

- `researches`
- `timeline_nodes`

短期 session/proposal 存 Redis。

DB replay 的事件顺序是：

1. `skeleton`
2. 每个完成节点的 `node_detail`
3. `synthesis`
4. `complete`

前端对 cached research 的体验依赖这个顺序。

### 前端

核心页面状态集中在 `frontend/src/components/SessionView.tsx`。

前端事件流连接集中在 `frontend/src/hooks/useResearchStream.ts`，它负责：

- 建立 EventSource
- 注册 named event listeners
- 最多 5 次指数退避重连
- complete/error 后主动关闭连接

前端 API/SSE 类型手写在 `frontend/src/types/index.ts`。这是下一轮重构最明显的契约漂移风险点。

Next rewrites 在 `frontend/next.config.ts` 中把 `/api/:path*` 代理到 `API_BASE_URL`，并关闭 compress 以避免开发环境 SSE buffering。

## 已完成的上一轮重构

`plans/backend-runtime-refactor-research.md` 里的主要建议大多已经落地：

- `backend/app/models/runtime.py`
- `backend/app/orchestrator/proposal.py`
- `backend/app/orchestrator/dedup.py`
- `backend/app/orchestrator/verification.py`
- `backend/app/orchestrator/phases/*`
- `backend/app/sse/event_publisher.py`
- `backend/app/session/lifecycle.py`

因此下一轮不应该再以“拆大 Orchestrator 文件”为主要目标。当前更有价值的是保护和收口跨层契约。

## 当前基线

已运行：

```bash
python3 backend/scripts/check_architecture.py
uv run ruff check .
uv run ruff format --check .
```

结果：

- 后端架构检查通过。
- 后端 Ruff lint 通过。
- 后端 Ruff format check 通过。

已运行：

```bash
pnpm lint
```

结果：

- 前端 lint 失败。

失败点：

- `frontend/src/components/EraNavigator.tsx`：render 中可变累加变量触发 `react-hooks/immutability`。
- `frontend/src/components/HistoryList.tsx`：effect 内同步 `setLoading(true)` 触发 `react-hooks/set-state-in-effect`。
- `frontend/src/components/RecommendedTopics.tsx`：同类 effect 同步 setState 问题。
- `frontend/src/hooks/useActiveNode.ts`：render 阶段写 ref 触发 `react-hooks/refs`。

另有未使用变量 warning：

- `Navbar.tsx`
- `NodeCard.tsx`
- `SessionView.tsx`
- `landing/Hero.tsx`

## 风险边界

### 1. API/SSE 契约漂移

后端 Pydantic model 与前端 TypeScript interface 是手写镜像。

已看到潜在漂移：

- `ResearchProposal` 后端已有 `research_phases`，前端类型没有。
- `RuntimeTimelineNode.to_sse_dict()` 可输出 `details`、`status`、`phase_name`、`is_gap_node`，但 `SkeletonNodeData` 只声明 `status: "skeleton"` 和 `phase_name`。
- 前端 `TimelineNode` 也没有 `is_gap_node`。

这类漂移不会被后端 Ruff 或架构检查捕捉。

### 2. Session lifecycle 路径复杂

同一个 session 可能来自：

- 内存 session
- Redis proposal/session snapshot
- DB completed research
- cached DB replay
- live executing session
- completed in-memory event history

这是当前最需要测试覆盖的后端边界。

### 3. Replay 与 live stream 语义不同

Live stream 会先推 partial skeleton，再推 dedup 后的 final skeleton，再推 detail。

DB replay 只推 final skeleton 和 detail。

前端 reducer 必须同时兼容 partial 和 full skeleton。

### 4. Agent import-time model resolution

多个 agent 模块在 import 时创建 `Agent(resolve_model(settings.xxx_model))`。

这会让单元测试和轻量导入依赖 `LITELLM_API_KEY` 等配置，降低可测试性。后续可以考虑懒加载 agent 或显式注入 model，但这属于计划阶段再评估的改造点。

### 5. Stale script

`scripts/test_dedup_models.py` 仍从 `app.orchestrator.orchestrator` import `_boundary_scan_dedup`、`_exact_title_dedup`、`_llm_year_group_dedup`、`_dedup_agent`。

这些符号现在已迁移到 `app.orchestrator.dedup`。该脚本很可能已经过期。

### 6. 前端 lint 不是干净基线

只要前端 lint 失败，后续 UI 或 state refactor 的验证结果都会混入旧噪声。

建议把“恢复前端 lint 干净基线”作为下一轮重构的第一个小任务，而不是和业务重构混在一起。

## 推荐重构方向

### P0：建立契约和验证基线

目标：先让未来重构有可靠反馈。

建议范围：

- 修复当前前端 lint errors。
- 增加后端 session lifecycle 的单元测试。
- 增加 SSE payload shape 测试，至少覆盖 skeleton、node_detail、synthesis、complete、research_error。
- 增加 DB replay 顺序测试。
- 更新 stale dedup model script import。

这不是产品能力重构，但能显著降低后续改 pipeline 的风险。

### P1：收口 API/SSE schema

目标：降低前后端类型漂移。

可选路径：

1. 轻量路径：手动补齐 `frontend/src/types/index.ts`，并加契约测试。
2. 中等路径：从后端 Pydantic model 导出 OpenAPI/schema，再生成或校验前端类型。
3. 重路径：定义独立 shared schema 生成两端类型。

当前阶段推荐轻量或中等路径，不建议一上来引入复杂 shared schema。

### P2：拆分 `SessionView`

目标：降低前端页面状态复杂度。

`SessionView` 同时负责：

- 新 session 创建
- existing session status fetch
- similar topic 分支
- proposal confirm
- stream state reducer
- local active session persistence
- timeline selection/highlight/scroll
- elapsed/progress
- research layout rendering

建议先抽出纯 reducer/hook，而不是直接拆 UI：

- `useSessionBootstrap`
- `useResearchEventsReducer`
- `useActiveSessionStorage`

这样可以优先测试状态转移，而不是先改视觉结构。

### P3：Agent/runtime 可测试性

目标：让不触发真实 LLM/search 的单元测试更容易写。

候选改造：

- agent lazy construction
- model resolver 注入
- TavilyService interface/protocol
- phase function 的 fake agent/fake tavily 测试入口

这会动到较多后端内部边界，应该排在 P0/P1 之后。

## 下一步建议

先写一份小而明确的 plan，范围限定为：

> Refactor baseline hardening：恢复前端 lint 干净基线，补齐 stale script import，建立最小 session/SSE/replay 契约测试。

不要直接进入大的架构重写。

在用户明确说“开始实现”之前，不写实现代码。
