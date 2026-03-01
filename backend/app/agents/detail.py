import logging

from pydantic_ai import Agent, UsageLimits

from app.config import settings
from app.models.research import NodeDetail
from app.services.llm import resolve_model
from app.services.tavily import TavilyService

logger = logging.getLogger(__name__)

_ALLOWED_TAGS = frozenset({
    "product_launch", "hardware", "software", "business", "policy", "milestone",
    "innovation", "partnership", "acquisition", "regulation", "cultural_shift",
    "scientific", "military", "diplomatic", "security", "infrastructure",
})

detail_agent = Agent(
    resolve_model(settings.detail_model),
    output_type=NodeDetail,
    instructions="""\
你是 Chrono 时间线调研系统的深度研究专家。你的任务是为时间线上的一个里程碑节点补充详细信息。

## 你会收到的信息

- 节点基本信息：日期、标题、概述、重要程度
- 搜索参考资料：已为你检索的相关资料（带编号和 URL）

## 输出要求

基于你的知识和提供的参考资料，填充以下字段：

### 核心字段
- key_features: 3-5 条关键特性或要点（每条一句话，必须是具体事实）
- impact: 这个事件的影响和意义（2-3 句话）
- key_people: 关键人物列表（人名 + 一句话说明角色）。如果没有特定关键人物可以为空列表
- context: 背景和因果关系（2-3 句话）
- sources: 留空（系统会自动填充）

### 数据与引用
- key_stats: 2-4 条关键数据或统计
  每条必须是一个简短的量化指标（不超过 15 个字/词），格式为 "指标: 数值" 或直接 "数值 + 说明"
  示例："首日销量: 27 万台" / "市值突破 1 万亿美元" / "峰值价格: $69,044"
  反面示例（不要这样写）："The Genesis block was mined on January 3, 2009 at 06:15:05 UTC"（这是事实描述不是统计）
  反面示例（不要这样写）："Block hash: 000000000019d6689c..."（这是技术参数不是统计）
  如果该事件没有明确的量化数据，可以为空列表

- notable_quote: 与该事件最相关的一条名人原话（格式："原话 —— 说话人, 身份"）
  必须是真实可查的引用，不要编造。如果找不到可靠引用，留空字符串

### 元数据
- location: 事件发生地（如 "Moscone Center, San Francisco"）
  线上事件或位置不明确时留空

- tags: 2-4 个英文分类标签，从以下选择：
  product_launch / hardware / software / business / policy / milestone /
  innovation / partnership / acquisition / regulation / cultural_shift /
  scientific / military / diplomatic / security / infrastructure
  仅从以上列表选择，不要自创标签

## 约束

- key_features 和 key_stats 必须是具体的事实和数据，不要写空泛的评价
- key_stats 和 key_features 不要有内容重叠。key_stats 只放量化数字指标，key_features 放定性的特征描述
- notable_quote 必须是真实引用，宁可留空也不要编造
- tags 始终用英文，不受输出语言影响
- 如果参考资料与你的知识有冲突，以参考资料为准""",
    retries=2,
)


async def run_detail_agent(
    node: dict,
    topic: str,
    language: str,
    tavily: TavilyService,
) -> tuple[NodeDetail, str]:
    """Returns (detail, search_context)."""
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
    # Clean up malformed empty quotes from LLM (e.g. '""', '"" ——', "''")
    if output.notable_quote:
        cleaned = output.notable_quote.strip("\"' ").replace("——", "").strip()
        if not cleaned:
            output.notable_quote = ""
    # Filter tags to allowed set
    if output.tags:
        output.tags = [t for t in output.tags if t in _ALLOWED_TAGS]
    return output, context
