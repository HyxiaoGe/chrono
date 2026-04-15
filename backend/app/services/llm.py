from __future__ import annotations

from pydantic_ai.models import Model
from pydantic_ai.models.openai import OpenAIModel
from pydantic_ai.providers.openai import OpenAIProvider

from app.config import settings

_provider: OpenAIProvider | None = None


def _get_provider() -> OpenAIProvider:
    """获取或创建指向 LiteLLM Proxy 的 provider 实例。"""
    global _provider
    if _provider is None:
        if not settings.litellm_api_key:
            raise ValueError("LITELLM_API_KEY is not configured. Set it in .env")
        _provider = OpenAIProvider(
            base_url=settings.litellm_base_url,
            api_key=settings.litellm_api_key,
        )
    return _provider


def resolve_model(model_string: str) -> Model:
    """
    解析模型字符串，返回 Pydantic AI Model 实例。

    格式: "provider/model_name"
      - "deepseek/deepseek-chat"  → 通过 LiteLLM Proxy 路由
      - "qwen/qwen-max"          → 通过 LiteLLM Proxy 路由
    """
    if "/" not in model_string:
        raise ValueError(
            f"Model string must have 'provider/model_name' format, got: '{model_string}'"
        )

    provider = _get_provider()
    return OpenAIModel(model_string, provider=provider)
