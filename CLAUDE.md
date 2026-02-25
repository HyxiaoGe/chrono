# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目简介

Chrono 是一个 Multi-Agent AI 时间线调研系统。用户输入关键词，系统通过多个 AI Agent 并行调研，生成交互式 Timeline。

技术方案详见 `docs/technical-design.md`，所有架构决策以该文档为准。

## 技术栈

- **后端**: Python 3.12+, FastAPI, Pydantic AI, asyncio
- **前端**: Next.js 15 (App Router), React 19, TypeScript
- **LLM 网关**: OpenRouter（统一调用多模型）
- **搜索**: Tavily API
- **前后端通信**: SSE (Server-Sent Events)
- **包管理**: 后端用 uv，前端用 pnpm

## 项目结构

```
chrono/
├── docs/
│   └── technical-design.md          # 技术方案文档（必读）
├── plans/                           # 功能实现计划（每个功能一个 md）
├── backend/
│   └── app/
│       ├── main.py            # FastAPI 入口
│       ├── orchestrator/      # Orchestrator 核心逻辑
│       ├── agents/            # Pydantic AI 子 Agent
│       ├── models/            # Pydantic 数据模型
│       ├── services/          # OpenRouter / Tavily 封装
│       └── sse/               # SSE 事件推送
├── frontend/
│   └── src/
│       ├── app/               # Next.js App Router
│       ├── components/        # React 组件
│       ├── hooks/             # 自定义 hooks（SSE 连接等）
│       └── types/             # TypeScript 类型定义
└── CLAUDE.md
```

## 核心架构原则（不可违背）

1. **两层分离**: 顶层编排用纯 asyncio，子 Agent 内部用 Pydantic AI。不要把编排逻辑塞进 Pydantic AI agent，也不要在 asyncio 层直接调 LLM。
2. **Orchestrator 全程在线**: Orchestrator 是持续运行的项目经理，不是一次性调度器。它要能动态 spawn/cancel agent、调整计划、推送进度。
3. **渐进式输出**: 每完成一个节点就通过 SSE 推送前端，不要攒一批再发。用户体验的核心是"边生成边看"。
4. **模型可切换**: 所有 LLM 调用走 OpenRouter，模型选择通过配置字符串控制，不要硬编码模型名到业务逻辑里。

## 开发工作流（严格遵守）

所有非 trivial 的功能开发，必须遵循以下流程。不允许跳过 Research 和 Plan 阶段直接写代码。

### Phase 1: Research（研究）

在动手之前，先深入阅读相关代码和文档，把发现写入持久化的 markdown 文件。

- 如果是在已有代码上做功能：深度阅读现有代码，理解函数内部逻辑、边界条件、与其他模块的交互。
- 如果是 greenfield 或引入新依赖：研究外部依赖的官方文档和最佳实践（如 Pydantic AI 怎么定义 Agent、FastAPI SSE 写法、OpenRouter/Tavily API 格式等）。
- 研究结果写入 `plans/<feature>-research.md`，不要只在聊天里口头总结。
- 这份 research 文档是我的审查面——我要通过它确认你真的理解了现有系统/依赖，再决定下一步。

### Phase 2: Plan（规划）

研究通过后，输出详细的实现计划。

- 计划写入 `plans/<feature>-plan.md`，包含：实现思路、涉及的文件和改动、代码片段、权衡取舍。
- **在我明确说"开始实现"之前，不要写任何实现代码。** 这是硬性规则。
- 如果某个开源项目或现有代码有好的参考实现，我会贴给你作为 reference，优先参照已验证的模式。

### Phase 3: Annotation Cycle（标注循环）

这是最重要的协作环节：

1. 你写完 plan.md
2. 我在文档里直接加 inline 批注（修正假设、否决方案、补充约束、提供领域知识）
3. 你根据批注更新文档，**不要实现，只更新计划**
4. 重复 1-6 轮，直到我满意

**关键规则：看到"不要实现"或"don't implement yet"时，只更新文档，绝不动代码。**

### Phase 4: Todo List（任务拆解）

计划确认后，在 plan.md 末尾追加一个细粒度的 todo list，分阶段列出所有子任务。这个 list 在实现阶段用来追踪进度。

### Phase 5: Implementation（实现）

收到"开始实现"指令后：

- 按 plan.md 中的 todo list 逐项执行
- 每完成一个任务或阶段，在 plan.md 中标记为已完成（✅）
- 不要中途停下来问确认，一口气跑完所有任务
- 持续运行 typecheck / lint，不要引入新问题
- 不要加多余的注释或 jsdoc，不要用 any / unknown 类型

### 实现阶段的反馈

实现过程中我的反馈会很简短，不需要长篇讨论：

- "这个函数你漏了"
- "应该是 PATCH 不是 PUT"
- "宽一点" / "间距不对"
- "参考 xxx 组件的样式"

收到这类简短指令，直接改，不需要反问确认。

如果方向跑偏了，我会 revert git changes 然后重新给一个收窄的指令，不要试图在错误的基础上修补。

## 代码规范

- Python 代码用 ruff 格式化和 lint
- 类型标注必须完整，后端所有函数都要有 type hints
- 前端用 TypeScript strict mode，不允许 any
- Pydantic model 定义所有 Agent 的输入输出结构，不要用裸 dict
- 异步函数统一用 async/await，不要混用 threading
- 变量和函数名用英文，注释中英文皆可
- 不要加多余的注释来解释显而易见的代码
- 遵循现有代码中的模式和风格，新代码应该跟已有代码长得一样

## 开发命令

```bash
# 后端
cd backend
uv sync                    # 安装依赖
uv run fastapi dev         # 启动开发服务器
uv run pytest              # 运行测试
uv run pytest tests/path_to_test.py::test_name  # 运行单个测试
uv run ruff check .        # lint 检查
uv run ruff format .       # 格式化

# 前端
cd frontend
pnpm install               # 安装依赖
pnpm dev                   # 启动开发服务器
pnpm build                 # 构建（含 TypeScript 类型检查）
pnpm lint                  # ESLint 检查
```

## 环境变量

```
OPENROUTER_API_KEY=        # OpenRouter API Key（必须）
TAVILY_API_KEY=            # Tavily 搜索 API Key（必须）
```

## 开发策略

- **纵切优先，不要逐层铺基建**：不要先把 SSE 全搭完、再搭 OpenRouter 封装、再写 Orchestrator。应该先跑通一条最小的端到端流程，自然串起所有模块，跑通了再横向扩展。
- **架构决策已定，不需要重新论证**：`technical-design.md` 里的选型（asyncio + Pydantic AI、OpenRouter、Tavily、SSE）都已确定，plan 阶段直接基于这些决策做实现层面的规划，不要花篇幅讨论"为什么用 X 而不是 Y"。

## 当前开发阶段

Phase 1: 后端骨架（优先级最高）

第一个目标：跑通最小端到端流程：

> `POST /research { topic: "iPhone" }` → Orchestrator 评估复杂度 → 返回调研提案 JSON

这条线自然会串起 FastAPI 路由、OpenRouter 调用、Orchestrator Phase 0 逻辑、Pydantic 数据模型。

暂时不需要关心的：
- 用户系统 / 认证
- 数据库 / 缓存
- 部署配置
- Epic 级调研策略（先跑通 Light 级别）
