from __future__ import annotations

from pydantic_ai.models import Model
from pydantic_ai.models.openai import OpenAIModel
from pydantic_ai.providers.openai import OpenAIProvider

from app.config import settings

_PROVIDERS: dict[str, dict] = {
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

_provider_cache: dict[str, OpenAIProvider] = {}


def _get_or_create_provider(name: str) -> OpenAIProvider:
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

    prov = OpenAIProvider(base_url=config["base_url"], api_key=api_key)
    _provider_cache[name] = prov
    return prov


def resolve_model(model_string: str) -> Model:
    """
    解析模型字符串，返回 Pydantic AI Model 实例。

    格式: "provider:model_name"
      - "deepseek:deepseek-chat"  → OpenAIModel (直连)
      - "qwen:qwen-max"          → OpenAIModel (直连)
    """
    if ":" not in model_string:
        raise ValueError(
            f"Model string must have 'provider:model_name' format, got: '{model_string}'. "
            f"Available providers: {list(_PROVIDERS.keys())}"
        )

    prefix, model_name = model_string.split(":", 1)
    prefix = prefix.lower()

    if prefix not in _PROVIDERS:
        raise ValueError(
            f"Unknown provider prefix: '{prefix}'. Available: {list(_PROVIDERS.keys())}"
        )

    provider = _get_or_create_provider(prefix)
    return OpenAIModel(model_name, provider=provider)
