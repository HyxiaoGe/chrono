# Chrono 编码规范

## Python 后端

- 依赖管理: `uv`
- Lint + Format: `ruff`（line-length: 100, rules: E/F/I/UP/B/SIM）
- 类型标注必须完整，所有函数都要有 type hints
- Pydantic model 定义所有 Agent 的输入输出结构，不要用裸 dict
- 异步函数统一用 async/await，不要混用 threading
- 变量和函数名用英文，注释中英文皆可
- 不要加多余的注释来解释显而易见的代码
- 遵循现有代码中的模式和风格

## TypeScript 前端

- 严格模式: `strict: true`，不允许 any
- 组件: 函数式组件 + Hooks
- 样式: Tailwind CSS
- 包管理: pnpm

## 开发工作流

所有非 trivial 的功能开发必须遵循五阶段流程：

1. **Research** — 深入阅读代码/文档，写入 `plans/<feature>-research.md`
2. **Plan** — 实现计划写入 `plans/<feature>-plan.md`，未获批准不动代码
3. **Annotation Cycle** — 文档批注循环，只更新计划不写代码
4. **Todo List** — 在 plan.md 末尾追加细粒度任务列表
5. **Implementation** — 按 todo list 逐项执行，完成后标记 ✅

## 开发命令

```bash
# 后端
cd backend && uv sync && uv run fastapi dev
uv run pytest                        # 测试
uv run ruff check . && uv run ruff format --check .  # lint

# 前端
cd frontend && pnpm install && pnpm dev
pnpm build                           # 构建 + 类型检查
pnpm lint                            # ESLint
```
