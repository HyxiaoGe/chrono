from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # --- LLM Proxy ---
    litellm_base_url: str = "http://litellm-proxy:4000"
    litellm_api_key: str = ""

    # --- Search ---
    tavily_api_key: str

    # --- Database / Redis ---
    database_url: str = ""
    redis_url: str = ""

    # --- 模型分配（格式: provider/model_name，通过 LiteLLM Proxy 路由）---
    orchestrator_model: str = "qwen/qwen-max"
    milestone_model: str = "deepseek/deepseek-chat"
    detail_model: str = "deepseek/deepseek-chat"
    dedup_model: str = "deepseek/deepseek-chat"
    hallucination_model: str = "deepseek/deepseek-chat"
    similar_topic_model: str = "deepseek/deepseek-chat"
    gap_analysis_model: str = "qwen/qwen-max"
    synthesizer_model: str = "qwen/qwen-max"

    detail_model_pool: str = ""
    detail_concurrency: int = 4

    model_config = {"env_file": ".env"}


settings = Settings()
