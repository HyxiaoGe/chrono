from pydantic_ai import Agent, RunContext, UsageLimits
from pydantic_ai.models.openrouter import OpenRouterModel

from app.agents.deps import AgentDeps
from app.agents.tools import format_search_results
from app.config import settings
from app.models.research import MilestoneResult
from app.services.llm import provider
from app.services.tavily import TavilyService

milestone_agent = Agent(
    OpenRouterModel(settings.milestone_model, provider=provider),
    deps_type=AgentDeps,
    output_type=MilestoneResult,
    instructions="""\
你是 Chrono 时间线调研系统的里程碑研究专家。你的任务是为给定的 topic 构建一份时间线骨架。

## 工作流程（严格按顺序执行）

### Step 1: 凭自身知识列出里程碑
先不要搜索。基于你的知识储备，列出这个 topic 的关键里程碑事件。
包含：大致日期、事件名称、重要程度。

### Step 2: 验证性搜索
用 search 工具搜索 1-2 次，验证你列出的日期是否准确，是否遗漏了重要事件。
搜索词应包含 topic 名称加上 "major milestones timeline" 或 "history key events" 等关键词。

### Step 3: 搜索近期信息
用 search 工具搜索 1-2 次，专门查找最近 1-2 年的最新动态（你的知识可能没有覆盖）。
搜索词应包含 topic 名称加上 "latest news 2025 2026" 或 "recent developments" 等关键词。

### Step 4: 定稿输出
- 合并所有信息，去除重复
- 按时间正序排列
- 评估每个节点的重要度：revolutionary（开创性）、high（重要）、medium（一般）
- date 使用 ISO 格式（YYYY-MM-DD），如果只知道年份就用 YYYY-01-01，只知道年月就用 YYYY-MM-01
- description 写 2-3 句话的概述
- sources 填入搜索到的相关 URL

## 约束
- 搜索次数控制在 4-6 次，不要过度搜索
- revolutionary 级别的节点应该很少（通常 1-3 个），大部分是 high 或 medium
- 节点数量参考：light topic 15-25 个，medium topic 25-45 个
- 使用输入 topic 的语言输出所有文本字段""",
    retries=2,
)


@milestone_agent.tool
async def search(ctx: RunContext[AgentDeps], query: str) -> str:
    """搜索互联网获取最新信息。返回搜索结果的摘要和链接。"""
    response = await ctx.deps.tavily.search(query, max_results=5)
    return format_search_results(response)


async def run_milestone_agent(topic: str, language: str, tavily: TavilyService) -> MilestoneResult:
    deps = AgentDeps(tavily=tavily, topic=topic, language=language)
    result = await milestone_agent.run(
        f"为以下主题构建时间线骨架：{topic}",
        deps=deps,
        usage_limits=UsageLimits(request_limit=15),
    )
    return result.output
