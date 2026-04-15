# Chrono

Multi-Agent AI 时间线调研系统。用户输入关键词，多个 AI Agent 并行调研，生成交互式 Timeline。

## 技术栈

- **后端**: Python 3.12 + FastAPI + Pydantic AI + asyncio + SSE
- **前端**: Next.js 15 + React 19 + TypeScript + Tailwind CSS
- **LLM**: 直连各厂商 API（DeepSeek / Qwen / Moonshot），搜索: Tavily API
- **数据库**: PostgreSQL + Redis

## 架构速览

两层分离：顶层编排(asyncio) + 子 Agent(Pydantic AI)，渐进式 SSE 输出。
五阶段调研管道：Skeleton → Detail → Gap Analysis → Synthesis → Persistence。
详见 → docs/technical-design.md

## 工作流程

1. **变更前**：非 trivial 功能必须走 Research → Plan → Annotation → Todo → Implementation 五阶段
2. **编码中**：遵守 docs/ARCHITECTURE_RULES.md，分层依赖不能反向
3. **变更后**：运行 `ruff check .` + `ruff format --check .`
4. **提交前**：确认 CI 门禁通过（架构检查 + Ruff lint）

## 关键约束

- 编排逻辑不能塞进 Pydantic AI agent，asyncio 层不能直接调 LLM
- Orchestrator 全程在线，能动态 spawn/cancel agent
- 每个节点完成即推 SSE，不要攒批
- 模型选择通过配置字符串（格式 provider:model_name），不要硬编码
- 在"开始实现"指令前，不写任何实现代码

## 开发命令

```bash
cd backend && uv sync && uv run fastapi dev          # 后端
cd frontend && pnpm dev                               # 前端
uv run ruff check . && uv run ruff format --check .   # lint
python3 scripts/check_architecture.py                  # 架构检查
```

## 文档索引

- [技术设计](docs/technical-design.md) — 完整架构方案（必读）
- [架构约束](docs/ARCHITECTURE_RULES.md) — 分层规则、核心原则
- [编码规范](docs/CODING_CONVENTIONS.md) — Python/TypeScript 规范、工作流
