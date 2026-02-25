from pydantic_ai.providers.openrouter import OpenRouterProvider

from app.config import settings

provider = OpenRouterProvider(
    api_key=settings.openrouter_api_key,
)
