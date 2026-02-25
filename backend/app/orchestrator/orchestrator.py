import asyncio
import logging

from pydantic_ai import Agent
from pydantic_ai.models.openrouter import OpenRouterModel

from app.agents.detail import run_detail_agent
from app.agents.milestone import run_milestone_agent
from app.config import settings
from app.models.research import ResearchProposal, ResearchRequest, SSEEventType
from app.models.session import ResearchSession, SessionStatus
from app.services.llm import provider
from app.services.tavily import TavilyService

logger = logging.getLogger(__name__)

_PROGRESS_MESSAGES: dict[str, dict[str, str]] = {
    "skeleton": {
        "zh": "正在构建时间线骨架...",
        "en": "Building timeline skeleton...",
        "ja": "タイムラインの骨格を構築中...",
    },
    "detail": {
        "zh": "正在深度补充节点详情...",
        "en": "Enriching timeline details...",
        "ja": "タイムラインの詳細を補充中...",
    },
}

_proposal_agent = Agent(
    OpenRouterModel(settings.orchestrator_model, provider=provider),
    output_type=ResearchProposal,
    instructions="""\
你是 Chrono 调研系统的策略规划专家。给定一个 topic，你需要分析它并生成一份结构化的调研提案。

## 你的任务

1. **判断 topic 类型**：product（产品）/ technology（技术）/ culture（文化现象）\
/ historical_event（历史事件）
2. **评估调研复杂度**：基于时间跨度、信息密度、并行线索数来判断
3. **规划调研维度**（research_threads）：每条维度带优先级(1-5)和预估节点数
4. **预估时长和额度**
5. **生成用户友好的展示文案**（user_facing）

## 复杂度评估标准

| 等级 | 节点数 | 额度 | 时长范围 | 典型场景 |
|------|--------|------|----------|---------|
| light | 15-25 | 1 | 90-180秒 | 单一产品/技术，时间跨度 < 20 年。如：iPhone, React, Spotify |
| medium | 25-45 | 2 | 180-240秒 | 多个发展阶段，有分支线索。如：微信, 比特币, Docker |
| deep | 50-80 | 3 | 240-360秒 | 跨度大或多线索并行。如：互联网发展史, 冷战, 人工智能 |
| epic | 80-150+ | 5 | 300-480秒 | 超大规模，需分阶段分线索。如：二战, 人类航天史, 中国改革开放 |

## 调研维度规划原则

- 每个维度应该是一个可独立调研的线索
- priority 5 = 核心主线（必须做），priority 1 = 补充线索（可跳过）
- 总节点数 = 各维度 estimated_nodes 之和，应与复杂度等级匹配
- 维度数量：light 1-2 条，medium 2-3 条，deep 3-5 条，epic 4-6 条

## user_facing 字段要求

- title：简洁的调研标题，如 "iPhone 发展史" / "History of React"
- summary：1-2 句话说明调研范围
- duration_text：用用户友好的方式表达时长，如 "约 2-3 分钟"
- credits_text：如 "消耗 1 额度"
- thread_names：调研维度名称列表，对应 research_threads 的 name 字段

## 示例

**输入**: "iPhone"
**预期输出要点**:
- topic_type: product
- complexity.level: light
- 维度: 产品迭代（priority 5, ~15 nodes）、生态与影响（priority 3, ~5 nodes）
- estimated_duration: {min_seconds: 90, max_seconds: 180}
- credits_cost: 1

**输入**: "比特币"
**预期输出要点**:
- topic_type: technology
- complexity.level: medium
- 维度: 技术演进（priority 5）、市场与监管（priority 4）、生态发展（priority 3）
- estimated_duration: {min_seconds: 180, max_seconds: 240}
- credits_cost: 2

**输入**: "二战"
**预期输出要点**:
- topic_type: historical_event
- complexity.level: epic
- 维度: 军事进程（priority 5）、政治外交（priority 4）、关键人物（priority 4）、\
科技与经济（priority 3）、社会影响（priority 3）
- estimated_duration: {min_seconds: 300, max_seconds: 480}
- credits_cost: 5

## 语言规则

- 检测输入 topic 的语言，设置 language 字段
- 所有文本字段（包括 user_facing）使用 topic 的语言
- 英文 topic → 英文输出，中文 topic → 中文输出""",
    retries=2,
)


def _get_progress_message(phase: str, language: str) -> str:
    messages = _PROGRESS_MESSAGES.get(phase, {})
    return messages.get(language, messages.get("en", "Processing..."))


class Orchestrator:
    def __init__(self, tavily: TavilyService) -> None:
        self.tavily = tavily

    async def create_proposal(self, request: ResearchRequest) -> ResearchProposal:
        result = await _proposal_agent.run(
            f"请评估以下调研主题并生成调研提案：{request.topic}",
        )
        proposal = result.output
        if request.language != "auto":
            proposal = proposal.model_copy(update={"language": request.language})
        return proposal

    async def execute_research(self, session: ResearchSession) -> None:
        proposal = session.proposal
        try:
            session.status = SessionStatus.EXECUTING

            # --- Phase 1: Skeleton ---
            await session.push(
                SSEEventType.PROGRESS,
                {
                    "phase": "skeleton",
                    "message": _get_progress_message("skeleton", proposal.language),
                    "percent": 0,
                },
            )

            milestone_result = await run_milestone_agent(
                topic=proposal.topic,
                language=proposal.language,
                tavily=self.tavily,
            )

            nodes = []
            for i, node in enumerate(milestone_result.nodes, start=1):
                nodes.append(
                    {
                        "id": f"ms_{i:03d}",
                        **node.model_dump(),
                        "status": "skeleton",
                    }
                )

            await session.push(SSEEventType.SKELETON, {"nodes": nodes})

            # --- Phase 2: Detail ---
            await session.push(
                SSEEventType.PROGRESS,
                {
                    "phase": "detail",
                    "message": _get_progress_message("detail", proposal.language),
                    "percent": 0,
                },
            )

            sem = asyncio.Semaphore(settings.detail_concurrency)
            detail_completed = 0
            total = len(nodes)

            async def _enrich_node(node: dict) -> None:
                nonlocal detail_completed
                async with sem:
                    try:
                        detail = await run_detail_agent(
                            node=node,
                            topic=proposal.topic,
                            language=proposal.language,
                            tavily=self.tavily,
                        )
                    except Exception:
                        logger.warning("Detail agent failed for node %s", node["id"])
                        return
                detail_completed += 1
                await session.push(
                    SSEEventType.NODE_DETAIL,
                    {
                        "node_id": node["id"],
                        "details": detail.model_dump(),
                    },
                )

            async with asyncio.TaskGroup() as tg:
                for node in nodes:
                    tg.create_task(_enrich_node(node))

            # --- Complete ---
            await session.push(
                SSEEventType.COMPLETE,
                {
                    "total_nodes": total,
                    "detail_completed": detail_completed,
                },
            )
            session.status = SessionStatus.COMPLETED

        except Exception:
            logger.exception("Research execution failed")
            await session.push(
                SSEEventType.RESEARCH_ERROR,
                {
                    "error": "research_failed",
                    "message": "Research execution failed. Please try again.",
                },
            )
            session.status = SessionStatus.FAILED
        finally:
            await session.close()
