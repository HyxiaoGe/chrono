import logging

from pydantic_ai import Agent, UsageLimits
from pydantic_ai.models.openrouter import OpenRouterModel

from app.config import settings
from app.models.research import NodeDetail
from app.services.llm import provider
from app.services.tavily import TavilyService

logger = logging.getLogger(__name__)

detail_agent = Agent(
    OpenRouterModel(settings.detail_model, provider=provider),
    output_type=NodeDetail,
    instructions="""\
你是 Chrono 时间线调研系统的深度研究专家。你的任务是为时间线上的一个里程碑节点补充详细信息。

## 你会收到的信息

- 节点基本信息：日期、标题、概述、重要程度
- 搜索参考资料：已为你检索的相关资料（带编号和 URL）

## 输出要求

基于你的知识和提供的参考资料，填充以下字段：

- key_features: 3-5 条关键特性或要点（每条一句话）
- impact: 这个事件的影响和意义（2-3 句话）
- key_people: 关键人物列表（人名 + 一句话说明角色）。如果没有特定关键人物可以为空列表
- context: 背景和因果关系（2-3 句话）
- sources: 留空（系统会自动填充）

## 约束

- key_features 必须是具体的事实，不要写空泛的评价
- 如果参考资料与你的知识有冲突，以参考资料为准""",
    retries=2,
)


async def run_detail_agent(
    node: dict,
    topic: str,
    language: str,
    tavily: TavilyService,
) -> NodeDetail:
    query = f"{topic} {node['title']} {node['date'][:4]}"
    try:
        context, urls = await tavily.search_and_format(query)
    except Exception:
        logger.warning("Search failed for %s, proceeding without context", node["title"])
        context, urls = "No search results available.", []

    prompt = (
        f"Topic: {topic}\n"
        f"Date: {node['date']}\n"
        f"Title: {node['title']}\n"
        f"Description: {node['description']}\n"
        f"Significance: {node['significance']}\n\n"
        f"搜索参考资料:\n{context}\n\n"
        f"请使用 {language} 输出所有文本字段。"
    )
    result = await detail_agent.run(
        prompt,
        usage_limits=UsageLimits(request_limit=4),
    )
    output = result.output
    output.sources = urls
    return output
