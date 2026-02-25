# OpenRouter API Research

## 1. API 基础信息

### Base URL

```
https://openrouter.ai/api/v1
```

所有端点挂在这个 base path 下，跟 OpenAI 的 `/v1` 结构一致。

主要端点：
- `POST /chat/completions` — 聊天补全（核心端点）
- `GET /models` — 获取可用模型列表
- `GET /key` — 查看 API key 的额度和用量

### 认证 & Headers

| Header | 必需 | 说明 |
|--------|------|------|
| `Authorization` | 是 | `Bearer <OPENROUTER_API_KEY>` |
| `Content-Type` | 是 | `application/json` |
| `HTTP-Referer` | 否 | 你的应用 URL，用于 OpenRouter 排行榜归属 |
| `X-OpenRouter-Title` (或 `X-Title`) | 否 | 你的应用名称，用于排行榜展示 |

API Key 在 https://openrouter.ai/keys 创建，格式为 `sk-or-...`。

### OpenAI 兼容性结论

**是的，OpenRouter 的 Chat Completions API 与 OpenAI 格式高度兼容。** 可以直接用 OpenAI SDK 的 `base_url` 参数指向 OpenRouter。

与 OpenAI 的区别（额外能力）：
- `provider` 参数：控制路由到哪些底层供应商、价格上限、延迟约束
- `models` 数组：指定多个备选模型做自动路由
- `plugins` 系统：内置 auto-router、内容审核、web search 等插件
- `reasoning` 参数：控制推理模型的 effort level
- `session_id`：会话分组
- `trace` / `metadata`：可观测性追踪

这些额外字段是 additive 的，不传就是标准 OpenAI 行为。

---

## 2. 模型字符串命名

OpenRouter 的模型 ID 格式为 `<provider>/<model-name>`。以下是我们技术方案中用到的模型的确切 ID：

### 我们需要的模型

| 用途 | 模型 | OpenRouter ID | 价格 (输入/输出 per M tokens) | Context |
|------|------|---------------|-------------------------------|---------|
| Orchestrator / Synthesizer | Claude Sonnet 4.5 | `anthropic/claude-sonnet-4.5` | $3 / $15 | 1M |
| Milestone / Detail Agent | DeepSeek V3 | `deepseek/deepseek-chat` | $0.32 / $0.89 | 163K |
| 日文编排层 | Gemini 2.5 Pro | `google/gemini-2.5-pro` | $1.25 / $10 | 1M |
| 日文编排层备选 | GPT-4o | `openai/gpt-4o` | $2.50 / $10 | 128K |
| 日文执行层 | Gemini 2.5 Flash | `google/gemini-2.5-flash` | $0.30 / $2.50 | 1M |
| 安全默认 | GPT-4o-mini | `openai/gpt-4o-mini` | $0.15 / $0.60 | 128K |

### 模型 ID 永久 slug

OpenRouter 对主要模型提供两种 ID：
- **动态别名**（如 `anthropic/claude-sonnet-4.5`）：始终指向该系列最新版
- **永久 slug**（如 `anthropic/claude-4.5-sonnet-20250929`）：固定指向某个具体版本

我们的配置应使用**动态别名**，这样模型更新时自动跟进，不需要改代码。

### 特殊后缀

OpenRouter 支持模型变体后缀：
- `:free` — 免费版本（有严格速率限制）
- `:thinking` — 推理/思考模式
- `:extended` — 扩展上下文
- `:nitro` — 低延迟版本
- `:online` — 带网络搜索

例如 `anthropic/claude-3.7-sonnet:thinking`, `deepseek/deepseek-r1:free`。

---

## 3. 请求格式

### Chat Completion Request Body

```python
{
    "model": "anthropic/claude-sonnet-4.5",  # 必需
    "messages": [                              # 必需
        {"role": "system", "content": "You are a research assistant."},
        {"role": "user", "content": "Tell me about the history of React."},
    ],
    # --- 以下全部可选 ---
    "temperature": 0.7,           # 0-2，默认 1
    "top_p": 1.0,                 # 0-1
    "max_tokens": 4096,           # 或 max_completion_tokens
    "stream": True,               # 启用 SSE 流式
    "stop": ["---"],              # 停止序列，最多 4 个
    "frequency_penalty": 0,       # -2.0 到 2.0
    "presence_penalty": 0,        # -2.0 到 2.0
    "seed": 42,                   # 可选，用于可复现输出
    "response_format": {          # 结构化输出
        "type": "json_schema",
        "json_schema": { ... }
    },
    "tools": [...],               # 工具/函数调用定义
    "tool_choice": "auto",        # none / auto / required / 指定函数
}
```

这个格式和 OpenAI Chat Completions API 完全一致。额外的 OpenRouter-specific 参数（`provider`, `plugins`, `reasoning` 等）是 additive 的。

### Response Format

```json
{
    "id": "gen-xxxx",
    "object": "chat.completion",
    "created": 1234567890,
    "model": "anthropic/claude-sonnet-4.5",
    "choices": [
        {
            "index": 0,
            "message": {
                "role": "assistant",
                "content": "React was created by..."
            },
            "finish_reason": "stop"
        }
    ],
    "usage": {
        "prompt_tokens": 150,
        "completion_tokens": 500,
        "total_tokens": 650
    }
}
```

---

## 4. Streaming

### 启用方式

请求体中设置 `"stream": true`，响应以 SSE (Server-Sent Events) 格式返回。

### SSE 格式

与 OpenAI 的 streaming 格式一致：

```
data: {"id":"gen-xxx","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"React"},"finish_reason":null}]}

data: {"id":"gen-xxx","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":" was"},"finish_reason":null}]}

data: {"id":"gen-xxx","object":"chat.completion.chunk","choices":[{"index":0,"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":150,"completion_tokens":500,"total_tokens":650}}

data: [DONE]
```

每个 chunk 的 `choices[0].delta.content` 包含增量文本。最后一个 chunk 包含 `usage` 统计。流以 `data: [DONE]` 终止。

### OpenRouter 特有行为

- OpenRouter 会定期发送 SSE comment（如 `: OPENROUTER PROCESSING`）来保持连接，防止超时。按 SSE 规范这些 comment 应被客户端忽略。
- 流式请求可以被取消（大部分 provider 支持，Groq/Bedrock 除外）。

### 流中错误处理

如果 token 已开始输出后发生错误，HTTP status 已经是 200 无法更改。此时错误以 SSE event 发送：
```json
{
    "choices": [{"finish_reason": "error", "delta": {"content": ""}}],
    "error": {"code": 502, "message": "Provider error..."}
}
```

---

## 5. Pydantic AI 集成

这是对我们架构最关键的部分。

### 方案 A：使用 Pydantic AI 原生 OpenRouter 支持（推荐）

Pydantic AI 已内置 OpenRouter provider，不需要走 OpenAI 的 hack 方式。

**安装：**
```bash
pip install "pydantic-ai-slim[openrouter]"
# 或
uv add "pydantic-ai-slim[openrouter]"
```

**环境变量：**
```bash
OPENROUTER_API_KEY=sk-or-...
```

**用法 1 — 字符串简写：**
```python
from pydantic_ai import Agent

agent = Agent('openrouter:anthropic/claude-sonnet-4.5')
result = await agent.run("What is the history of React?")
```

`openrouter:` 前缀告诉 Pydantic AI 使用内置的 OpenRouter provider。

**用法 2 — 显式实例化（可配置更多选项）：**
```python
from pydantic_ai import Agent
from pydantic_ai.models.openrouter import OpenRouterModel
from pydantic_ai.providers.openrouter import OpenRouterProvider

provider = OpenRouterProvider(
    api_key="sk-or-...",        # 或从环境变量读取
    app_url="https://chrono.app",   # 可选，用于 OpenRouter 排行榜
    app_title="Chrono",             # 可选
)

model = OpenRouterModel("anthropic/claude-sonnet-4.5", provider=provider)
agent = Agent(model)
result = await agent.run("What is the history of React?")
```

**用法 3 — 自定义 model settings：**
```python
from pydantic_ai.models.openrouter import OpenRouterModel, OpenRouterModelSettings

settings = OpenRouterModelSettings(
    openrouter_reasoning={"effort": "high"},
    openrouter_usage={"include": True},
)
model = OpenRouterModel("anthropic/claude-sonnet-4.5")
agent = Agent(model, model_settings=settings)
```

### 方案 B：使用 OpenAIModel + base_url（也可行，但不推荐）

```python
from pydantic_ai import Agent
from pydantic_ai.models.openai import OpenAIModel

model = OpenAIModel(
    "anthropic/claude-sonnet-4.5",
    base_url="https://openrouter.ai/api/v1",
    api_key="sk-or-...",
)
agent = Agent(model)
```

这种方式也能工作（因为 OpenRouter 是 OpenAI 兼容的），但缺点是：
- 无法使用 `OpenRouterModelSettings` 的 OpenRouter-specific 参数
- 无法设置 app attribution（`app_url`, `app_title`）
- Pydantic AI 可能不会正确处理 OpenRouter 特有的响应字段

### 结论

**使用方案 A（原生 OpenRouter provider）**。Pydantic AI 已经做了专门支持，不需要走 OpenAI 兼容层。

### 动态切换模型

在我们的架构中，不同 Agent 用不同模型。Pydantic AI 支持在创建 Agent 时指定模型，也支持运行时覆盖：

```python
# 创建时指定默认模型
agent = Agent('openrouter:deepseek/deepseek-chat')

# 运行时用不同模型覆盖
result = await agent.run(
    "...",
    model='openrouter:anthropic/claude-sonnet-4.5',
)
```

这完美匹配我们的"模型可切换"架构原则。

---

## 6. 错误处理 & Rate Limits

### HTTP 错误码

| 状态码 | 含义 | 处理策略 |
|--------|------|----------|
| 400 | 参数错误 | 检查请求格式，不重试 |
| 401 | 认证失败（key 无效/过期）| 检查 API key，不重试 |
| 402 | 余额不足 | 通知用户充值，不重试 |
| 403 | 内容审核拒绝 | 记录日志，不重试 |
| 408 | 请求超时 | 可重试 |
| 429 | 速率限制 | 指数退避重试 |
| 502 | 模型不可用/provider 错误 | 指数退避重试，或切换模型 |
| 503 | 无可用 provider | 切换模型或稍后重试 |

### 错误响应格式

```json
{
    "error": {
        "code": 429,
        "message": "Rate limit exceeded",
        "metadata": { ... }
    }
}
```

### Rate Limits

- **付费模型**：没有明确的 per-minute 限制文档，主要受 credit 余额控制
- **免费模型**（`:free` 后缀）：有严格的 per-minute 和 daily 请求上限
- DDoS 保护由 Cloudflare 处理，异常流量会被拦截

**查看当前用量：**
```python
# GET https://openrouter.ai/api/v1/key
# Authorization: Bearer sk-or-...
# 返回 limit, limit_remaining, usage, is_free_tier 等
```

### 推荐的重试策略

```python
import asyncio
import random

async def call_with_retry(func, max_retries=3):
    for attempt in range(max_retries):
        try:
            return await func()
        except Exception as e:
            if is_retryable(e) and attempt < max_retries - 1:
                wait = (2 ** attempt) + random.uniform(0, 1)  # 指数退避 + jitter
                await asyncio.sleep(wait)
            else:
                raise
```

---

## 7. 对 Chrono 项目的架构影响

### 配置方案

建议在配置中维护一个模型映射表，所有 Agent 通过角色名获取模型 ID：

```python
MODEL_CONFIG = {
    "orchestrator": "anthropic/claude-sonnet-4.5",
    "milestone": "deepseek/deepseek-chat",
    "detail": "deepseek/deepseek-chat",
    "impact": "deepseek/deepseek-chat",
    "synthesizer": "anthropic/claude-sonnet-4.5",
}
```

语言路由时只需替换这个映射表中的值。

### OpenRouter Provider 单例

整个后端应共享一个 `OpenRouterProvider` 实例（底层是一个 `AsyncOpenAI` client），避免为每个 Agent 创建新连接：

```python
from pydantic_ai.providers.openrouter import OpenRouterProvider

provider = OpenRouterProvider(
    api_key=settings.openrouter_api_key,
    app_url="https://chrono.app",
    app_title="Chrono",
)
```

然后各 Agent 共享这个 provider，只是传不同的 model name。

### 依赖安装

```toml
# pyproject.toml
[project]
dependencies = [
    "pydantic-ai-slim[openrouter]",
    # ...
]
```

不需要单独安装 `openai` 包，`pydantic-ai-slim[openrouter]` 已经包含了。

---

## 8. 关键结论

1. **OpenRouter 是 OpenAI-compatible 的**，base URL 为 `https://openrouter.ai/api/v1`，请求/响应格式与 OpenAI Chat Completions API 一致。
2. **Pydantic AI 有原生 OpenRouter 支持**，使用 `OpenRouterModel` + `OpenRouterProvider`，不需要走 OpenAI 兼容 hack。简写语法 `'openrouter:<model-id>'` 最简洁。
3. **Streaming 完全兼容** OpenAI 的 SSE 格式，`stream: true` 即可启用，额外注意 OpenRouter 会发送 SSE comment 保活。
4. **模型切换零代码改动**，只需改模型 ID 字符串（如 `deepseek/deepseek-chat` -> `anthropic/claude-sonnet-4.5`）。
5. **DeepSeek V3 的性价比极高**（$0.32/$0.89 per M tokens vs Claude Sonnet 4.5 的 $3/$15），完全验证了技术方案中"Sonnet 做大脑，便宜模型做四肢"的策略。
