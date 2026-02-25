# Phase 1 Research — 外部依赖调研

## 1. Pydantic AI

详细研究见 `pydantic-ai-research.md`。

### 核心概念

- **Agent 定义**：`Agent(model, output_type=, deps_type=, instructions=, tools=, retries=)`。Agent 在模块级定义一次，跨请求复用（类似 FastAPI app 实例）。
- **Structured output**：`output_type` 设为 Pydantic model，LLM 被强制返回匹配 schema 的数据。验证失败时自动重试（最多 `retries` 次）。默认使用 "tool output" 模式（schema 作为 tool 定义发给 LLM）。
- **Tool 注册**：三种方式——`@agent.tool`（带 RunContext）、`@agent.tool_plain`（无 context）、`tools=[]` 构造参数。工具的 docstring 成为 LLM 看到的描述。
- **依赖注入**：`deps_type` 定义依赖类型（通常是 dataclass），运行时通过 `agent.run(deps=...)` 传入。工具、system prompt、validator 都可通过 `RunContext[DepsType].deps` 访问。
- **运行方式**：`agent.run()` 异步 / `agent.run_sync()` 同步。返回 `AgentRunResult`，`.output` 是类型化的结构化输出。
- **模型覆盖**：运行时可用 `model=` 参数覆盖默认模型，完美匹配我们的多模型策略。

### OpenRouter 集成

**Pydantic AI 原生支持 OpenRouter**，不需要 OpenAI 兼容 hack。

```bash
uv add "pydantic-ai-slim[openrouter]"
```

```python
# 简写
agent = Agent('openrouter:anthropic/claude-sonnet-4.5')

# 显式实例化（可配 app attribution）
from pydantic_ai.models.openrouter import OpenRouterModel
from pydantic_ai.providers.openrouter import OpenRouterProvider

provider = OpenRouterProvider(api_key="sk-or-...", app_url="https://chrono.app", app_title="Chrono")
model = OpenRouterModel("anthropic/claude-sonnet-4.5", provider=provider)
```

### 对 Chrono 的映射

| Chrono 层 | 技术 | 职责 |
|-----------|------|------|
| Orchestrator | 纯 asyncio | spawn/cancel agent、状态管理、SSE 推送 |
| 子 Agent | Pydantic AI Agent | LLM 交互、structured output、tool use |
| 模型路由 | OpenRouter 字符串 | `"openrouter:provider/model"` |
| 依赖 | `deps_type` dataclass | Tavily client、搜索预算等 |

---

## 2. FastAPI SSE

详细研究见 `sse-research.md`。

### 结论：用 sse-starlette

**不用原生 StreamingResponse**，理由：
- 无 keepalive ping（代理/负载均衡器会超时断连）
- 客户端断连后 generator 继续运行（资源泄漏）
- 手动拼 SSE 格式
- 无 send timeout、无优雅关闭

**sse-starlette** 解决了以上所有问题：
- `ServerSentEvent(data=, event=, id=)` — 结构化事件构造
- 内建 keepalive ping（默认 15 秒）
- 自动检测客户端断连并 cancel generator
- `send_timeout` 防止阻塞
- 监听 uvicorn shutdown 信号优雅关闭

```bash
uv add sse-starlette
```

### 核心架构模式：asyncio.Queue 桥接

Orchestrator（后台生产者）和 SSE endpoint（消费者）通过 `asyncio.Queue` 解耦：

```
Orchestrator → queue.put(event) → SSE endpoint → await queue.get() → yield ServerSentEvent
```

这使 Orchestrator 不感知 SSE 的存在，完全解耦。

### 生产注意事项

- Nginx 反代需设 `X-Accel-Buffering: no` header
- 后端不部署在 Vercel（有执行时长限制），用 Railway/Fly.io

---

## 3. OpenRouter API

详细研究见 `openrouter-research.md`。

### 基础信息

- Base URL: `https://openrouter.ai/api/v1`
- 完全 OpenAI 兼容（请求/响应格式一致）
- 认证：`Authorization: Bearer sk-or-...`
- 可选：`HTTP-Referer`（app URL）、`X-OpenRouter-Title`（app 名称）

### 模型字符串

格式：`<provider>/<model-name>`

| 用途 | OpenRouter ID | 价格 (input/output per M tokens) |
|------|---------------|----------------------------------|
| Orchestrator / Synthesizer | `anthropic/claude-sonnet-4.5` | $3 / $15 |
| Milestone / Detail / Impact | `deepseek/deepseek-chat` | $0.32 / $0.89 |
| 日文编排 | `google/gemini-2.5-pro` | $1.25 / $10 |
| 日文执行 | `google/gemini-2.5-flash` | $0.30 / $2.50 |
| 安全默认 | `openai/gpt-4o-mini` | $0.15 / $0.60 |

使用动态别名（非固定版本 slug），模型更新时自动跟进。

### 关键结论

- Pydantic AI 原生支持，用 `'openrouter:<model-id>'` 即可
- 整个后端共享一个 `OpenRouterProvider` 实例
- 模型切换只需改字符串，零代码改动
- DeepSeek V3 的性价比（$0.32/$0.89）完全验证了"Sonnet 做大脑，便宜模型做四肢"的策略

---

## 4. Tavily API

详细研究见 `tavily-research.md`。

### Python SDK

```bash
uv add tavily-python
```

```python
from tavily import AsyncTavilyClient
client = AsyncTavilyClient(api_key="tvly-...")  # 或读 TAVILY_API_KEY 环境变量
```

- 完全异步（`httpx.AsyncClient`，连接池复用）
- API 与同步版完全一致，方法名相同

### 搜索参数（关键的）

```python
await client.search(
    query="...",                    # 必填
    search_depth="basic",          # "basic"(1 credit) / "advanced"(2 credits)
    topic="general",               # "general" / "news"（返回 published_date）/ "finance"
    max_results=5,                 # 0-20
    include_answer=True,           # 获取 AI 生成的摘要
    time_range="year",             # "day" / "week" / "month" / "year"
    include_raw_content=False,     # 完整页面内容（开销大）
)
```

### 响应结构

```python
{
    "query": "...",
    "answer": "AI generated summary...",  # include_answer=True 时
    "results": [
        {
            "title": "...",
            "url": "...",
            "content": "relevant snippet...",
            "score": 0.95,             # 相关度 0.0-1.0
            "published_date": "...",   # topic="news" 时
        }
    ],
    "response_time": 1.23
}
```

### 对 Timeline 调研的最佳实践

- `topic="news"` 返回 `published_date`，对时间线构建直接有用
- `include_answer=True` 获取快速摘要供 Agent 使用
- `AsyncTavilyClient` 初始化一次，全局复用
- `asyncio.gather(return_exceptions=True)` 并行搜索
- `search_depth="basic"` 满足大部分场景，`"advanced"` 留给低质量结果
- 免费 1,000 credits/月，开发阶段充裕

### 错误处理

```python
from tavily import UsageLimitExceededError, InvalidAPIKeyError, BadRequestError
```

---

## 5. 依赖总结

### pyproject.toml 依赖

```toml
dependencies = [
    "fastapi",
    "uvicorn[standard]",
    "pydantic-ai-slim[openrouter]",
    "sse-starlette",
    "tavily-python",
    "pydantic-settings",     # 环境变量配置
]
```

### 环境变量

```
OPENROUTER_API_KEY=sk-or-...
TAVILY_API_KEY=tvly-...
```

### 关键发现

1. **Pydantic AI 原生支持 OpenRouter** — 不需要 OpenAI 兼容 hack，用 `'openrouter:model-id'` 简写语法即可
2. **sse-starlette 是 SSE 的正确选择** — 内建 keepalive、断连检测、优雅关闭
3. **asyncio.Queue 桥接模式** — Orchestrator 和 SSE endpoint 解耦的标准方案
4. **Tavily 完全异步** — `AsyncTavilyClient` 与 `asyncio.gather` 配合做并行搜索
5. **模型切换零代码改动** — OpenRouter 模型字符串 + Pydantic AI 运行时覆盖
6. **Agent 模块级定义** — Pydantic AI Agent 实例化一次全局复用，运行时通过 `deps=` 传入不同上下文
