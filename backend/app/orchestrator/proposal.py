from __future__ import annotations

import logging
from datetime import date

from pydantic_ai import Agent

from app.config import settings
from app.models.research import ResearchProposal, ResearchRequest
from app.services.llm import resolve_model
from app.services.tavily import TavilyService

logger = logging.getLogger(__name__)


_proposal_agent = Agent(
    resolve_model(settings.orchestrator_model),
    output_type=ResearchProposal,
    instructions=(
        "当前日期：" + date.today().isoformat() + "。请确保调研时间范围覆盖到当前时间。\n\n"
        """\
你是 Chrono 调研系统的策略规划专家。给定一个 topic，你需要分析它并生成一份结构化的调研提案。

## 你的任务

1. **判断 topic 类型**：product（产品）/ technology（技术）/ culture（文化现象）\
/ historical_event（历史事件）
2. **评估调研复杂度**：基于时间跨度、信息密度、并行线索数来判断
3. **规划调研维度**（research_threads）：每条维度带优先级(1-5)和预估节点数
4. **判断是否需要分阶段**（research_phases）：详见下方"分阶段调研"
5. **预估时长和额度**
6. **生成用户友好的展示文案**（user_facing）

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
- **近期变革敏感度**：规划维度时必须考虑该领域近 3 年内是否有重大范式变革\
（如 AI 转型、新能源转型、监管重构等）。如果有，必须给予独立的调研维度，\
不能仅作为其他维度的子话题。对于企业/产品类 topic，"最新战略方向"应优先\
成为独立维度。如果用户 prompt 中提供了近期动态参考信息，务必据此调整维度规划。

## 分阶段调研（research_phases）

对于大跨度、多阶段的 topic，需要先按时间/主题拆分为若干阶段（phase），\
每个阶段内再独立规划维度。这能避免单个 Agent 负担过重、减少跨维度重复。

### 何时使用分阶段

- **epic 级**：必须分阶段
- **deep 级**：如果时间跨度 > 30 年且存在明显的阶段性转折，建议分阶段；\
如果时间跨度短但信息密度高、线性发展（如"区块链技术"），不分阶段
- **light / medium**：不分阶段，research_phases 留空列表

### 分阶段规则

- 阶段数：3-6 个
- 每个阶段包含 time_range（如 "1933-1939"）、name、description
- 每个阶段内的维度数：2-3 个（比顶层维度少，因为范围更聚焦）
- 每个阶段内各维度的 estimated_nodes 之和控制在 15-30
- **阶段间的时间范围不能重叠**（避免重复）
- 各阶段节点数之和应与复杂度等级匹配

### 使用分阶段时的字段关系

- research_threads：仍然填写顶层维度概览（用于 user_facing.thread_names 展示）
- research_phases：填写详细的阶段拆分，每个 phase 内有独立的 threads
- 实际执行时，如果 research_phases 非空，pipeline 会使用 phases 内的 threads \
而非顶层 research_threads

## user_facing 字段要求

- title：简洁的调研标题，如 "iPhone 发展史" / "History of React"
- summary：1-2 句话说明调研范围
- duration_text：用用户友好的方式表达时长，如 "约 2-3 分钟"
- credits_text：如 "消耗 1 额度"
- thread_names：调研维度名称列表，对应 research_threads 的 name 字段

## 语言规则

- 检测输入 topic 的语言，设置 language 字段
- 所有文本字段（包括 user_facing、research_phases 的 name/description）使用 topic 的语言
- 英文 topic → 英文输出，中文 topic → 中文输出"""
    ),
    retries=2,
)


def normalize_language(language: str) -> str:
    if language == "auto":
        return ""
    return language.split("-")[0].lower()


async def create_proposal(
    request: ResearchRequest,
    tavily: TavilyService,
) -> ResearchProposal:
    language = normalize_language(request.language)

    current_year = date.today().year
    is_zh = language.startswith("zh") if language else not request.topic.isascii()
    if is_zh:
        query = f"{request.topic} 最新动态 重大变革 {current_year - 1} {current_year}"
    else:
        query = (
            f"{request.topic} latest developments major changes {current_year - 1} {current_year}"
        )
    try:
        context, _ = await tavily.search_and_format(query, max_results=5)
    except Exception:
        logger.warning("Proposal search augmentation failed, proceeding without context")
        context = ""

    prompt = f"请评估以下调研主题并生成调研提案：{request.topic}"
    if context:
        label = (
            "以下是该主题的近期动态（供维度规划参考）"
            if is_zh
            else "Recent developments for reference"
        )
        prompt += f"\n\n{label}：\n{context}"
    if language:
        prompt += f'\n\n要求：所有文本字段使用 {language} 输出。设置 language 字段为 "{language}"。'

    result = await _proposal_agent.run(prompt)
    proposal = result.output
    if language:
        proposal = proposal.model_copy(update={"language": language})
    return proposal
