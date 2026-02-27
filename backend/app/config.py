from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # --- API Keys ---
    openrouter_api_key: str
    tavily_api_key: str
    deepseek_api_key: str = ""
    moonshot_api_key: str = ""
    doubao_api_key: str = ""
    qwen_api_key: str = ""

    # --- Database / Redis ---
    database_url: str = ""
    redis_url: str = ""

    # --- 模型分配（前缀决定路由，无前缀默认走 OpenRouter）---
    orchestrator_model: str = "openrouter:anthropic/claude-opus-4.6"
    milestone_model: str = "openrouter:deepseek/deepseek-chat"
    detail_model: str = "openrouter:deepseek/deepseek-chat"
    dedup_model: str = "openrouter:deepseek/deepseek-chat"
    hallucination_model: str = "openrouter:deepseek/deepseek-chat"
    gap_analysis_model: str = "openrouter:anthropic/claude-opus-4.6"
    synthesizer_model: str = "openrouter:anthropic/claude-opus-4.6"

    detail_concurrency: int = 4

    model_config = {"env_file": ".env"}


settings = Settings()
