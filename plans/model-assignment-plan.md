# 模型分配升级 — 实施计划

## 概述

基于最新模型调研，对 7 个 Agent 的模型分配做质量优化。核心变更：Hallucination Filter 换 GPT-5.2，Synthesizer 换 Gemini 3.1 Pro。

## 当前状态 vs 目标状态

### 当前状态

`.env` 中**没有任何模型覆盖行**，7 个 Agent 全部使用 `config.py` 中的默认值：

| Agent | 当前实际值（config.py 默认） |
|-------|---------------------------|
| Orchestrator | `openrouter:anthropic/claude-opus-4.6` |
| Milestone | `openrouter:deepseek/deepseek-chat` |
| Detail | `openrouter:deepseek/deepseek-chat` |
| Dedup | `openrouter:deepseek/deepseek-chat` |
| Hallucination | `openrouter:deepseek/deepseek-chat` |
| Gap Analysis | `openrouter:anthropic/claude-opus-4.6` |
| Synthesizer | `openrouter:anthropic/claude-opus-4.6` |

### 目标状态

| Agent | 目标值 | 路由 | 变更类型 |
|-------|--------|------|----------|
| Orchestrator | `openrouter:anthropic/claude-opus-4.6` | OpenRouter | 已匹配，无需覆盖 |
| Milestone | `qwen:qwen-max` | Qwen 直连 | **需新增 .env 行** |
| Detail | `deepseek:deepseek-chat` | DeepSeek 直连 | **需新增 .env 行** |
| Dedup | `moonshot:kimi-k2-0905-preview` | Moonshot 直连 | **需新增 .env 行** |
| Hallucination | `openrouter:openai/gpt-5.2` | OpenRouter | **需新增 .env 行** |
| Gap Analysis | `openrouter:anthropic/claude-opus-4.6` | OpenRouter | 已匹配，无需覆盖 |
| Synthesizer | `openrouter:google/gemini-3.1-pro-preview` | OpenRouter | **需新增 .env 行** |

**实际改动量**：需在 `.env` 中新增 5 行模型覆盖（不是 2 行）。Orchestrator 和 Gap Analysis 的默认值已匹配目标，无需覆盖。

## 模型 ID 勘误

用户指令中的部分模型 ID 需要修正：

| 用户写法 | 实际可用 ID | 原因 |
|---------|------------|------|
| `kimi:k2.5` | `moonshot:kimi-k2.5` | ① provider 前缀已改名为 `moonshot`（匹配 `MOONSHOT_API_KEY`）；② API 端的 model ID 是 `kimi-k2.5`，不是 `k2.5` |
| `openrouter:google/gemini-3.1-pro` | `openrouter:google/gemini-3.1-pro-preview` | OpenRouter 上只有 `google/gemini-3.1-pro-preview`，没有不带 `-preview` 的版本 |
| `openrouter:anthropic/claude-opus-4-6` | `openrouter:anthropic/claude-opus-4.6` | config.py 中已是正确的 `4.6`（用点号不是短横线） |

### GPT-5.2 Thinking 说明

OpenRouter 上 GPT-5.2 相关变体：
- `openai/gpt-5.2` — 标准版（内置 thinking）
- `openai/gpt-5.2-chat` — 纯对话版（无 thinking）
- `openai/gpt-5.2-pro` — Pro 版

用户要求"优先使用 thinking 版本"，`openai/gpt-5.2` 即为内置 thinking 的标准版，无需加 `:thinking` 后缀。

## 验证清单

以下模型 ID 均已通过 API 实测验证：

- [x] `openrouter:anthropic/claude-opus-4.6` — 已验证 ✅
- [x] `qwen:qwen-max` — 已验证 ✅
- [x] `deepseek:deepseek-chat` — 已验证 ✅
- [x] `moonshot:kimi-k2.5` — 模型列表确认存在 ✅（`/v1/models` 返回 `kimi-k2.5`）
- [x] `openrouter:openai/gpt-5.2` — 已验证 ✅
- [x] `openrouter:google/gemini-3.1-pro-preview` — 已验证 ✅

**注意**：`moonshot:kimi-k2.5` 虽然存在于模型列表中，但其 thinking 模式与 Pydantic AI 的 `tool_choice: required`（structured output）冲突，返回 400 错误。改用 `moonshot:kimi-k2-0905-preview`（最新的非 thinking K2 版本）。

## 实施步骤

### Step 1: 在 `.env` 中新增 5 行模型覆盖

```bash
# --- 模型分配 ---
MILESTONE_MODEL=qwen:qwen-max
DETAIL_MODEL=deepseek:deepseek-chat
DEDUP_MODEL=moonshot:kimi-k2-0905-preview
HALLUCINATION_MODEL=openrouter:openai/gpt-5.2
SYNTHESIZER_MODEL=openrouter:google/gemini-3.1-pro-preview
```

不需要覆盖的（config.py 默认值已匹配）：
- `ORCHESTRATOR_MODEL` — 默认 `openrouter:anthropic/claude-opus-4.6` ✓
- `GAP_ANALYSIS_MODEL` — 默认 `openrouter:anthropic/claude-opus-4.6` ✓

### Step 2: 创建 `.env.example`

```bash
# --- API Keys ---
OPENROUTER_API_KEY=        # 必须
TAVILY_API_KEY=            # 必须
DEEPSEEK_API_KEY=          # Detail Agent 直连
QWEN_API_KEY=              # Milestone Agent 直连
MOONSHOT_API_KEY=          # Dedup Agent 直连
DOUBAO_API_KEY=            # 预留（当前未使用）

# --- 模型分配（前缀决定路由，改这里切换模型，不碰代码）---
# ORCHESTRATOR_MODEL=openrouter:anthropic/claude-opus-4.6    # 默认值，无需设置
MILESTONE_MODEL=qwen:qwen-max
DETAIL_MODEL=deepseek:deepseek-chat
DEDUP_MODEL=moonshot:kimi-k2-0905-preview
HALLUCINATION_MODEL=openrouter:openai/gpt-5.2
SYNTHESIZER_MODEL=openrouter:google/gemini-3.1-pro-preview
# GAP_ANALYSIS_MODEL=openrouter:anthropic/claude-opus-4.6    # 默认值，无需设置
```

### Step 3: 验证

1. `uv run fastapi dev` 启动无报错
2. E2E 测试 "iPhone" — pipeline 完整跑通
3. 重点关注：
   - Hallucination Filter 是否用 GPT-5.2 成功判断（日志确认模型调用）
   - Synthesizer 是否用 Gemini 3.1 Pro 生成最终叙事
   - Dedup 是否用 kimi-k2.5 成功去重
   - Milestone 是否用 qwen-max 生成里程碑

## 不涉及的变更

- 不改代码（config.py、llm.py、agent 文件、orchestrator.py 均不动）
- 不改 pipeline 逻辑、prompt、schema
- 不改 API key（已全部配好）

## Todo List

- [x] `.env` 新增 5 行模型覆盖 ✅
- [x] 创建 `.env.example` ✅
- [x] `moonshot:kimi-k2.5` 实际调用验证 → ❌ thinking 模式与 structured output 冲突，改用 `kimi-k2-0905-preview` ✅
- [x] E2E "iPhone" 完整测试 — 26 nodes, 26 details, 15 connections ✅
