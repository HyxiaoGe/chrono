from __future__ import annotations

from pydantic_ai.models import Model
from pydantic_ai.models.openai import OpenAIModel
from pydantic_ai.models.openrouter import OpenRouterModel
from pydantic_ai.providers.openai import OpenAIProvider
from pydantic_ai.providers.openrouter import OpenRouterProvider

from app.config import settings

_PROVIDERS: dict[str, dict] = {
    "openrouter": {
        "api_key_attr": "openrouter_api_key",
        "use_openrouter": True,
    },
    "deepseek": {
        "base_url": "https://api.deepseek.com",
        "api_key_attr": "deepseek_api_key",
    },
    "moonshot": {
        "base_url": "https://api.moonshot.cn/v1",
        "api_key_attr": "moonshot_api_key",
    },
    "doubao": {
        "base_url": "https://ark.cn-beijing.volces.com/api/v3",
        "api_key_attr": "doubao_api_key",
    },
    "qwen": {
        "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
        "api_key_attr": "qwen_api_key",
    },
}

_provider_cache: dict[str, OpenRouterProvider | OpenAIProvider] = {}


def _get_or_create_provider(name: str) -> OpenRouterProvider | OpenAIProvider:
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
            f"Unknown provider prefix: '{prefix}'. Available: {list(_PROVIDERS.keys())}"
        )

    provider = _get_or_create_provider(prefix)

    if prefix == "openrouter":
        return OpenRouterModel(model_name, provider=provider)
    return OpenAIModel(model_name, provider=provider)
