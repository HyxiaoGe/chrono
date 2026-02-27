# Multi-Provider Model Routing — Implementation Plan

## 概述

当前所有 LLM 调用都走 OpenRouter 转发。高频调用的 DeepSeek 模型（milestone、detail、dedup、hallucination）可以直连 DeepSeek API，省去中间商费用，降低延迟。

核心思路：用**前缀约定**声明每个模型走哪条路，改 `.env` 一行就能切换路由，不碰代码。

## 前缀约定

```
openrouter:anthropic/claude-sonnet-4.5   → OpenRouter 转发
deepseek:deepseek-chat                    → DeepSeek 直连
kimi:moonshot-v1-128k                     → Kimi 直连
doubao:doubao-pro-256k                    → 豆包直连
```

**向后兼容**：无前缀的字符串（如 `"deepseek/deepseek-chat"`）默认走 OpenRouter，不破坏现有行为。

## Pydantic AI API 确认（v1.63.0）

| 用途 | 类 | 来源 |
|------|-----|------|
| OpenRouter 转发 | `OpenRouterModel` + `OpenRouterProvider` | `pydantic_ai.models.openrouter` / `pydantic_ai.providers.openrouter` |
| OpenAI 兼容直连 | `OpenAIModel` + `OpenAIProvider` | `pydantic_ai.models.openai` / `pydantic_ai.providers.openai` |

DeepSeek、Kimi、豆包都是 OpenAI-compatible API，统一用 `OpenAIModel(model_name, provider=OpenAIProvider(base_url=..., api_key=...))` 接入。

| Provider | Base URL |
|----------|----------|
| DeepSeek | `https://api.deepseek.com` |
| Kimi | `https://api.moonshot.cn/v1` |
| 豆包 | `https://ark.cn-beijing.volces.com/api/v3` |

## 涉及文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `backend/pyproject.toml` | 修改 | 新增 `pydantic-ai-slim[openai]` 依赖 |
| `backend/app/config.py` | 修改 | 新增直连 API key 字段，模型默认值加前缀 |
| `backend/app/services/llm.py` | 重写 | Provider 注册表 + `resolve_model()` |
| `backend/app/agents/detail.py` | 修改 | 2 行：import + model 创建 |
| `backend/app/agents/milestone.py` | 修改 | 2 行 |
| `backend/app/agents/synthesizer.py` | 修改 | 2 行 |
| `backend/app/agents/gap_analysis.py` | 修改 | 2 行 |
| `backend/app/orchestrator/orchestrator.py` | 修改 | 3 个 agent 的 model 创建（proposal、dedup、hallucination） |

## 详细设计

### 0. pyproject.toml — 新增依赖

当前只有 `pydantic-ai-slim[openrouter]`。直连需要 `OpenAIModel` + `OpenAIProvider`，来自 `pydantic-ai-slim[openai]` extra。

```toml
# 合并写法
"pydantic-ai-slim[openrouter,openai]",
```

加完后 `uv sync` 安装。

### 1. config.py

```python
class Settings(BaseSettings):
    # --- API Keys ---
    openrouter_api_key: str
    tavily_api_key: str
    deepseek_api_key: str = ""      # 空字符串 = 不启用直连
    kimi_api_key: str = ""
    doubao_api_key: str = ""

    # --- 模型分配（前缀决定路由）---
    orchestrator_model: str = "openrouter:anthropic/claude-sonnet-4.5"
    milestone_model: str = "deepseek:deepseek-chat"
    detail_model: str = "deepseek:deepseek-chat"
    dedup_model: str = "deepseek:deepseek-chat"
    hallucination_model: str = "deepseek:deepseek-chat"
    gap_analysis_model: str = "openrouter:anthropic/claude-sonnet-4.5"
    synthesizer_model: str = "openrouter:anthropic/claude-sonnet-4.5"

    detail_concurrency: int = 4
    model_config = {"env_file": ".env"}
```

变更点：
- 新增 `deepseek_api_key`、`kimi_api_key`、`doubao_api_key`（默认空，不强制）
- 新增 `dedup_model`、`hallucination_model`（当前硬编码用 `milestone_model`，拆开便于独立控制）
- 所有模型默认值加前缀，明确路由意图

### 2. services/llm.py — 完整重写

```python
from __future__ import annotations

from pydantic_ai.models import Model
from pydantic_ai.models.openai import OpenAIModel
from pydantic_ai.models.openrouter import OpenRouterModel
from pydantic_ai.providers.openai import OpenAIProvider
from pydantic_ai.providers.openrouter import OpenRouterProvider

from app.config import settings

# ---- Provider 注册表 ----
_PROVIDERS: dict[str, dict] = {
    "openrouter": {
        "api_key_attr": "openrouter_api_key",
        "use_openrouter": True,
    },
    "deepseek": {
        "base_url": "https://api.deepseek.com",
        "api_key_attr": "deepseek_api_key",
    },
    "kimi": {
        "base_url": "https://api.moonshot.cn/v1",
        "api_key_attr": "kimi_api_key",
    },
    "doubao": {
        "base_url": "https://ark.cn-beijing.volces.com/api/v3",
        "api_key_attr": "doubao_api_key",
    },
}

_provider_cache: dict[str, object] = {}


def _get_or_create_provider(name: str):
    """获取或创建 provider 实例（缓存复用连接）。"""
    if name in _provider_cache:
        return _provider_cache[name]

    config = _PROVIDERS[name]
    api_key = getattr(settings, config["api_key_attr"])
    if not api_key:
        raise ValueError(
            f"API key for provider '{name}' is not configured. "
            f"Set {config['api_key_attr'].upper()} in .env"
        )

    if config.get("use_openrouter"):
        prov = OpenRouterProvider(api_key=api_key)
    else:
        prov = OpenAIProvider(base_url=config["base_url"], api_key=api_key)

    _provider_cache[name] = prov
    return prov


def resolve_model(model_string: str) -> Model:
    """
    解析模型字符串，返回 Pydantic AI Model 实例。

    格式: "provider:model_name"
      - "openrouter:anthropic/claude-sonnet-4.5" → OpenRouterModel
      - "deepseek:deepseek-chat"                  → OpenAIModel (直连)

    向后兼容: 无前缀 → 默认走 OpenRouter
      - "deepseek/deepseek-chat" → OpenRouterModel("deepseek/deepseek-chat")
    """
    if ":" in model_string:
        # split(":", 1) 只分第一个冒号，保留 model_name 中的 `:thinking` 等 OpenRouter 后缀
        prefix, model_name = model_string.split(":", 1)
        prefix = prefix.lower()
    else:
        prefix = "openrouter"
        model_name = model_string

    if prefix not in _PROVIDERS:
        raise ValueError(
            f"Unknown provider prefix: '{prefix}'. "
            f"Available: {list(_PROVIDERS.keys())}"
        )

    provider = _get_or_create_provider(prefix)

    if prefix == "openrouter":
        return OpenRouterModel(model_name, provider=provider)
    return OpenAIModel(model_name, provider=provider)
```

旧的 `provider` 单例不再导出，所有消费方改用 `resolve_model()`。

### 3. Agent 文件改造

每个文件改 2 行，以 `detail.py` 为例：

```python
# 之前
from pydantic_ai.models.openrouter import OpenRouterModel
from app.services.llm import provider

detail_agent = Agent(
    OpenRouterModel(settings.detail_model, provider=provider),
    ...
)

# 之后
from app.services.llm import resolve_model

detail_agent = Agent(
    resolve_model(settings.detail_model),
    ...
)
```

删除 `from pydantic_ai.models.openrouter import OpenRouterModel` 和 `from app.services.llm import provider`，换成 `from app.services.llm import resolve_model`。

4 个 agent 文件（detail、milestone、synthesizer、gap_analysis）同理。

### 4. Orchestrator 改造

orchestrator.py 有 3 个 module-level agent，同样改法：

```python
# 之前
from pydantic_ai.models.openrouter import OpenRouterModel
from app.services.llm import provider

_proposal_agent = Agent(
    OpenRouterModel(settings.orchestrator_model, provider=provider), ...
)
_dedup_agent = Agent(
    OpenRouterModel(settings.milestone_model, provider=provider), ...
)
_hallucination_agent = Agent(
    OpenRouterModel(settings.milestone_model, provider=provider), ...
)

# 之后
from app.services.llm import resolve_model

_proposal_agent = Agent(
    resolve_model(settings.orchestrator_model), ...
)
_dedup_agent = Agent(
    resolve_model(settings.dedup_model), ...        # 新配置字段
)
_hallucination_agent = Agent(
    resolve_model(settings.hallucination_model), ... # 新配置字段
)
```

### 5. .env 示例

```bash
# --- API Keys ---
OPENROUTER_API_KEY=sk-or-xxxxxxxx
DEEPSEEK_API_KEY=sk-xxxxxxxx
TAVILY_API_KEY=tvly-xxxxxxxx
# KIMI_API_KEY=           # 留空=不启用
# DOUBAO_API_KEY=         # 留空=不启用

# --- 模型分配（改这里切换路由，不碰代码）---
ORCHESTRATOR_MODEL=openrouter:anthropic/claude-sonnet-4.5
MILESTONE_MODEL=deepseek:deepseek-chat
DETAIL_MODEL=deepseek:deepseek-chat
DEDUP_MODEL=deepseek:deepseek-chat
HALLUCINATION_MODEL=deepseek:deepseek-chat
GAP_ANALYSIS_MODEL=openrouter:anthropic/claude-sonnet-4.5
SYNTHESIZER_MODEL=openrouter:anthropic/claude-sonnet-4.5
```

切回 OpenRouter 转发：`MILESTONE_MODEL=openrouter:deepseek/deepseek-chat`
换用 Kimi：`DETAIL_MODEL=kimi:moonshot-v1-128k`

### 6. 扩展新 Provider

两步：
1. `_PROVIDERS` 字典加一条 `{ "base_url": ..., "api_key_attr": ... }`
2. `Settings` 加一个 `xxx_api_key: str = ""`

## 当前 7 个 Agent 的路由汇总

| Agent | 配置字段 | 默认路由 | 模型 | 可切直连 |
|-------|---------|---------|------|---------|
| Proposal | `orchestrator_model` | openrouter | claude-sonnet-4.5 | - |
| Milestone | `milestone_model` | openrouter | deepseek-chat | `deepseek:deepseek-chat` |
| Detail | `detail_model` | openrouter | deepseek-chat | `deepseek:deepseek-chat` |
| Dedup | `dedup_model` (新增) | openrouter | deepseek-chat | `deepseek:deepseek-chat` |
| Hallucination | `hallucination_model` (新增) | openrouter | deepseek-chat | `deepseek:deepseek-chat` |
| Gap Analysis | `gap_analysis_model` | openrouter | claude-sonnet-4.5 | - |
| Synthesizer | `synthesizer_model` | openrouter | claude-sonnet-4.5 | - |

## Todo List

### Phase A: 依赖 + 基础设施

- [x] `pyproject.toml` 新增 `pydantic-ai-slim[openai]` 依赖，`uv sync` 安装
- [x] `config.py` 新增 3 个 API key 字段 + 2 个模型配置字段 + 所有默认值加前缀
- [x] `services/llm.py` 重写为 Provider 注册表 + `resolve_model()`（注意 `split(":", 1)` 保留 `:thinking` 后缀）

### Phase B: Agent 迁移（每个文件改 2 行）

- [x] `agents/detail.py`：`OpenRouterModel` → `resolve_model`
- [x] `agents/milestone.py`：同上
- [x] `agents/synthesizer.py`：同上
- [x] `agents/gap_analysis.py`：同上

### Phase C: Orchestrator 迁移

- [x] `orchestrator.py`：3 个 agent 改用 `resolve_model`，dedup/hallucination 改用新配置字段

### Phase D: 环境配置

- [x] `.env` 补 `DEEPSEEK_API_KEY` 占位（填入实际 key 后配合 `deepseek:` 前缀即可直连）

### Phase E: 验证

- [x] `ruff check && ruff format` — 通过
- [x] `uv run fastapi dev` 启动无报错
- [x] E2E 测试 "iPhone"：19 nodes, 20 details, 13 connections, synthesis 完整 ✅

备注：config.py 默认值统一用 `openrouter:` 前缀（向后兼容），用户设 `DEEPSEEK_API_KEY` + `MILESTONE_MODEL=deepseek:deepseek-chat` 即可切换直连。
