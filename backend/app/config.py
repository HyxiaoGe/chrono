from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    openrouter_api_key: str
    tavily_api_key: str

    orchestrator_model: str = "anthropic/claude-sonnet-4.5"
    milestone_model: str = "deepseek/deepseek-chat"
    detail_model: str = "deepseek/deepseek-chat"
    synthesizer_model: str = "anthropic/claude-sonnet-4.5"
    gap_analysis_model: str = "anthropic/claude-sonnet-4.5"

    detail_concurrency: int = 4

    model_config = {"env_file": ".env"}


settings = Settings()
