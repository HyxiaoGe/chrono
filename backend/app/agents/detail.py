from pydantic_ai import Agent, RunContext, UsageLimits
from pydantic_ai.models.openrouter import OpenRouterModel

from app.agents.deps import AgentDeps
from app.agents.tools import format_search_results
from app.config import settings
from app.models.research import NodeDetail
from app.services.llm import provider
from app.services.tavily import TavilyService

detail_agent = Agent(
    OpenRouterModel(settings.detail_model, provider=provider),
    deps_type=AgentDeps,
    output_type=NodeDetail,
    instructions="""\
你是 Chrono 时间线调研系统的深度研究专家。你的任务是为时间线上的一个里程碑节点补充详细信息。

## 你会收到的信息

一个里程碑节点的基本信息：日期、标题、概述、重要程度。

## 工作流程（严格按顺序执行）

### Step 1: 基于自身知识生成初稿
先不要搜索。根据你的知识储备，填充以下字段：
- key_features: 3-5 条关键特性或要点（每条一句话）
- impact: 这个事件的影响和意义（2-3 句话）
- key_people: 关键人物列表（人名 + 一句话说明角色）
- context: 背景和因果关系——这个事件为什么会发生？之前发生了什么导致了它？（2-3 句话）

### Step 2: 搜索补充
用 search 工具搜索 1-2 次，补充你不确定的事实数据（具体数字、精确日期、人物全名等）。\
搜索词应该具体到这个事件本身，不要搜索整个 topic 的宽泛信息。

### Step 3: 定稿
合并搜索到的新信息到各字段中。如果搜索结果与你的知识有冲突，以搜索结果为准。\
sources 填入搜索到的相关 URL。

## 约束
- 搜索次数严格控制在 1-2 次，不要过度搜索
- key_features 必须是具体的事实，不要写空泛的评价
- key_people 如果确实没有特定关键人物（比如某个技术标准发布），可以为空列表
- 使用输入指定的语言输出所有文本字段""",
    retries=2,
)


@detail_agent.tool
async def search(ctx: RunContext[AgentDeps], query: str) -> str:
    """搜索互联网获取最新信息。返回搜索结果的摘要和链接。"""
    response = await ctx.deps.tavily.search(query, max_results=5)
    return format_search_results(response)


async def run_detail_agent(
    node: dict,
    topic: str,
    language: str,
    tavily: TavilyService,
) -> NodeDetail:
    deps = AgentDeps(tavily=tavily, topic=topic, language=language)
    prompt = (
        f"Topic: {topic}\n\n"
        f"Date: {node['date']}\n"
        f"Title: {node['title']}\n"
        f"Description: {node['description']}\n"
        f"Significance: {node['significance']}"
    )
    result = await detail_agent.run(
        prompt,
        deps=deps,
        usage_limits=UsageLimits(request_limit=8),
    )
    return result.output
