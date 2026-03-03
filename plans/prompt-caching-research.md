# Prompt Caching Research

## Context

Chrono 的高频 Agent（Detail ×20-86, Milestone ×4-15, Dedup ×5-20）每次调用都发送完整的 system prompt。需要确认各 provider 的 prompt caching 机制是否已自动生效，以及是否需要代码改动。

## Pydantic AI 消息构造方式

通过阅读 Pydantic AI v1.63.0 源码确认：

1. **System prompt 作为第一个 system role message 发送**（`models/openai.py:1083-1101`）
2. **OpenRouterModel 继承 OpenAIChatModel**（`models/openrouter.py:535`），不覆盖 `_map_messages()`，消息构造方式完全一致
3. **静态 instructions 在每次 run 中逐字相同** — 框架不会注入 timestamp、run_id 或其他动态内容
4. **动态 instructions**（async function）只在显式定义时才运行 — Chrono 的 Agent 全部使用静态字符串 instructions

结论：**Pydantic AI 的调用方式天然支持 prefix caching** — system prompt 始终是 messages 数组的第一个元素，且内容每次相同。

---

## Provider 分析

### 1. OpenRouter（经 OpenRouter 代理调用）

**机制**: OpenRouter 对支持 caching 的上游模型自动启用 prompt caching，无需额外参数。

**支持的模型**:
- DeepSeek (V3, R1): ✅ 自动
- Claude (Opus 4, Sonnet 4): ⚠️ 需要 `cache_control` 标记（见下方说明）
- Gemini 2.5 (Pro, Flash): ✅ 自动
- GPT-4o / GPT 系列: ✅ 自动

**Anthropic Claude 特殊处理**: Claude 通过 OpenRouter 调用时，caching 需要在 message content 中添加 `cache_control` breakpoint。Pydantic AI 有 `anthropic_cache_instructions` 设置，但这只对 AnthropicModel 生效，不对 OpenRouterModel 生效。OpenRouterModel 的 `_map_messages()` 会过滤掉 `CachePoint` markers（源码注释："OpenAI doesn't support prompt caching via CachePoint, so we filter it out"）。

**Pydantic AI 设置**: `OpenAIChatModelSettings` 支持 `openai_prompt_cache_key` 和 `openai_prompt_cache_retention` 参数，可传递给 OpenAI 兼容的 provider。但 OpenRouter 是否透传这些参数给上游尚未确认。

**当前状态**: Chrono 通过 OpenRouter 调用 DeepSeek、Gemini 时，自动享受 caching。通过 OpenRouter 调用 Claude Opus 时，caching 可能未生效（需要 `cache_control` 标记，但 Pydantic AI 的 OpenRouterModel 不支持传递）。

### 2. DeepSeek 直连

**机制**: Context caching 完全自动，基于 prefix matching。

**命中条件**:
- System prompt 相同前缀 ≥ 64 tokens 即可命中
- 首次调用后几秒钟缓存建立，后续调用自动命中
- 无需任何参数或 header

**定价**: cache hit 的 input tokens 按 $0.014/M（原价 $0.14/M），**10 倍折扣**。

**API 响应**: `usage` 中包含 `prompt_cache_hit_tokens` 和 `prompt_cache_miss_tokens`。

**当前状态**: Chrono 通过 `OpenAIModel + OpenAIProvider(base_url="https://api.deepseek.com")` 直连 DeepSeek 时，自动享受 caching。Pydantic AI 的 OpenAIModel 将 instructions 作为 system message 发送，满足 prefix matching 条件。**无需任何改动**。

### 3. Qwen 直连（Dashscope）

**机制**: 隐式 prefix caching 自动启用，与 DeepSeek 类似。

**支持的模型**: qwen-max, qwen-plus, qwen-flash（qwen-3-next 暂不支持）

**命中条件**:
- 前缀匹配，最小 1,024 tokens
- 自动生效，无需配置

**可选显式控制**: 支持 `cache_control: {"type": "ephemeral"}` 参数标记特定内容（类似 Anthropic 语法），但不是必需的。

**当前状态**: Chrono 通过 `OpenAIModel + OpenAIProvider(base_url="https://dashscope.aliyuncs.com/...")` 直连 Qwen 时，自动享受 caching。**无需任何改动**。

### 4. Moonshot 直连（Kimi）

**机制**: **显式两阶段 caching** — 需要先通过单独 API 创建 cache 获取 `cache_id`，然后在请求中通过 `role="cache"` 引用。

**使用方式**:
1. 调用 cache 创建 API，上传 system prompt → 获得 `cache_id`
2. 请求 messages 数组首位放 `{"role": "cache", "content": "cache_id=xxx;reset_ttl=3600"}`

**定价**: cache hit 仅 0.02 CNY/M tokens（原价约 0.6 CNY/M），但有 cache 创建费（24 CNY/M tokens）和存储费（10 CNY/M tokens/min）。

**Pydantic AI 支持**: Pydantic AI 的 OpenAIModel 不支持 `role="cache"` 消息类型。实现 Moonshot caching 需要自定义 message mapping，改动量较大。

**当前状态**: Chrono 通过 Moonshot 直连调用时，**caching 未生效**。但 Moonshot 主要用于 Kimi K2 模型，该模型通常通过 OpenRouter 调用（自动 caching），直连场景较少。

---

## 总结

| Provider | 路径 | Caching 状态 | 需要改动 |
|----------|------|-------------|---------|
| OpenRouter → DeepSeek | `openrouter:deepseek/deepseek-chat` | ✅ 自动生效 | 无 |
| OpenRouter → Gemini | `openrouter:google/gemini-2.5-*` | ✅ 自动生效 | 无 |
| OpenRouter → Claude | `openrouter:anthropic/claude-opus-4` | ⚠️ 可能未生效 | 需要 cache_control（改动大，收益小）|
| DeepSeek 直连 | `deepseek:deepseek-chat` | ✅ 自动生效 | 无 |
| Qwen 直连 | `qwen:qwen-max` | ✅ 自动生效 | 无 |
| Moonshot 直连 | `moonshot:kimi-k2-0905` | ❌ 未生效 | 需要自定义 message mapping（改动大）|

## 结论

**绝大多数场景无需改动。**

- Chrono 的高频 Agent（Detail、Milestone、Dedup）默认走 `openrouter:deepseek/deepseek-chat`，OpenRouter 自动启用 DeepSeek 的 prefix caching，**已在享受 10 倍 input token 折扣**。
- DeepSeek/Qwen 直连同样自动生效。
- Claude Opus 通过 OpenRouter 的 caching 可能未生效，但 Claude 仅用于 Orchestrator（1 次/调研）、Gap Analysis（1 次/调研）、Synthesizer（1 次/调研），调用频次极低，即使未命中 cache 对成本影响可忽略。
- Moonshot 直连 caching 需要较大改动（自定义 message type），且直连 Moonshot 场景少（通常走 OpenRouter），**建议暂不实现**。

**无需代码改动。当前架构已自动受益于 prompt caching。**
