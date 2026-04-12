# Chrono 架构约束

## 核心原则（不可违背）

1. **两层分离**: 顶层编排用纯 asyncio，子 Agent 内部用 Pydantic AI。不要把编排逻辑塞进 Pydantic AI agent，也不要在 asyncio 层直接调 LLM
2. **Orchestrator 全程在线**: Orchestrator 是持续运行的项目经理，不是一次性调度器。它要能动态 spawn/cancel agent、调整计划、推送进度
3. **渐进式输出**: 每完成一个节点就通过 SSE 推送前端，不要攒一批再发
4. **模型可切换**: 所有 LLM 调用走 OpenRouter，模型选择通过配置字符串控制，不要硬编码模型名到业务逻辑里

## 分层依赖规则

```
API (main.py)  →  Orchestrator (orchestrator/)  →  Agents (agents/)
                       ↓                              ↓
                  Services (services/)  ←  Models (models/)
                       ↓
                    DB (db/)
```

依赖方向只能向下：
- orchestrator 可以调用 agents, services, models, db
- agents 可以调用 services, models
- services 可以调用 models
- models 和 db 不能调用 orchestrator, agents

## 开发策略

- **纵切优先**：先跑通一条最小端到端流程，再横向扩展
- **架构决策已定**：technical-design.md 里的选型不需要重新论证
