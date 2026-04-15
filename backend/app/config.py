from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # --- API Keys ---
    tavily_api_key: str
    deepseek_api_key: str = ""
    moonshot_api_key: str = ""
    doubao_api_key: str = ""
    qwen_api_key: str = ""

    # --- Database / Redis ---
    database_url: str = ""
    redis_url: str = ""

    # --- 模型分配（格式: provider:model_name，直连各厂商 API）---
    orchestrator_model: str = "qwen:qwen-max"
    milestone_model: str = "deepseek:deepseek-chat"
    detail_model: str = "deepseek:deepseek-chat"
    dedup_model: str = "deepseek:deepseek-chat"
    hallucination_model: str = "deepseek:deepseek-chat"
    similar_topic_model: str = "deepseek:deepseek-chat"
    gap_analysis_model: str = "qwen:qwen-max"
    synthesizer_model: str = "qwen:qwen-max"

    detail_model_pool: str = ""
    detail_concurrency: int = 4

    model_config = {"env_file": ".env"}


settings = Settings()
