import asyncio
import logging
from datetime import date

from pydantic import BaseModel
from pydantic_ai import Agent

from app.agents.detail import run_detail_agent
from app.agents.gap_analysis import run_gap_analysis_agent
from app.agents.milestone import run_milestone_agent
from app.agents.synthesizer import run_synthesizer_agent
from app.config import settings
from app.db.database import async_session_factory
from app.db.repository import save_research
from app.models.research import (
    GapAnalysisResult,
    HallucinationCheckResult,
    ResearchProposal,
    ResearchRequest,
    ResearchThread,
    Significance,
    SkeletonNode,
    SSEEventType,
)
from app.models.session import ResearchSession, SessionStatus
from app.services.llm import resolve_model
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
    "analysis": {
        "zh": "正在分析时间线完整性...",
        "en": "Analyzing timeline completeness...",
        "ja": "タイムラインの完全性を分析中...",
    },
    "synthesis": {
        "zh": "正在生成调研总结...",
        "en": "Generating research summary...",
        "ja": "調査サマリーを生成中...",
    },
}

_proposal_agent = Agent(
    resolve_model(settings.orchestrator_model),
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


def _normalize_language(language: str) -> str:
    """Normalize BCP47 language tag to short form. Returns '' for 'auto'."""
    if language == "auto":
        return ""
    return language.split("-")[0].lower()


def _get_progress_message(phase: str, language: str) -> str:
    messages = _PROGRESS_MESSAGES.get(phase, {})
    short = language.split("-")[0].lower()
    return messages.get(short, messages.get("en", "Processing..."))


_SIG_RANK = {Significance.MEDIUM: 0, Significance.HIGH: 1, Significance.REVOLUTIONARY: 2}


# --- LLM-based dedup ---


class _DedupGroup(BaseModel):
    indices: list[int]


class _DedupResult(BaseModel):
    duplicate_groups: list[_DedupGroup]


_dedup_agent = Agent(
    resolve_model(settings.dedup_model),
    output_type=_DedupResult,
    instructions="""\
You are a dedup specialist. Given a list of timeline events \
(with index, date, title, description), \
identify groups of events that refer to the SAME real-world event.

Rules:
- Two events are duplicates if they describe the same real-world occurrence, \
even if titles are in different languages or worded differently
- Date proximity matters: events more than 365 days apart are almost certainly NOT duplicates
- Return only groups with 2+ items. Events with no duplicate should NOT appear in any group
- Each event index should appear in at most one group
- Output an empty duplicate_groups list if there are no duplicates""",
    retries=1,
)


def _group_by_year(
    nodes: list[SkeletonNode],
) -> dict[str, list[tuple[int, SkeletonNode]]]:
    groups: dict[str, list[tuple[int, SkeletonNode]]] = {}
    for i, node in enumerate(nodes):
        try:
            year = str(date.fromisoformat(node.date).year)
        except ValueError:
            year = "unknown"
        groups.setdefault(year, []).append((i, node))
    return groups


async def _dedup_year_group(
    nodes_with_idx: list[tuple[int, SkeletonNode]],
) -> list[list[int]]:
    if len(nodes_with_idx) < 2:
        return []

    lines = []
    for orig_idx, node in nodes_with_idx:
        lines.append(f"[{orig_idx}] {node.date} | {node.title} | {node.description[:80]}")
    prompt = "Find duplicate events:\n" + "\n".join(lines)

    try:
        result = await _dedup_agent.run(prompt)
        return [g.indices for g in result.output.duplicate_groups]
    except Exception:
        logger.warning("Dedup agent failed for year group, skipping dedup")
        return []


def _pick_language_matching(nodes: list[SkeletonNode], language: str) -> SkeletonNode:
    if language in ("zh", "ja", "ko"):
        for node in nodes:
            if any("\u4e00" <= ch <= "\u9fff" for ch in node.title):
                return node
    return max(nodes, key=lambda n: len(n.title))


def _pick_precise_date(nodes: list[SkeletonNode]) -> str:
    for node in nodes:
        if not node.date.endswith("-01-01"):
            return node.date
    return nodes[0].date


def _merge_duplicate_group(
    nodes: list[SkeletonNode], indices: list[int], language: str
) -> SkeletonNode:
    group = [nodes[i] for i in indices]
    best_title_node = _pick_language_matching(group, language)
    best_sig = max(group, key=lambda n: _SIG_RANK.get(n.significance, 0)).significance
    best_desc = max(group, key=lambda n: len(n.description)).description
    all_sources = list({url for n in group for url in n.sources})
    best_date = _pick_precise_date(group)
    best_subtitle = max(group, key=lambda n: len(n.subtitle)).subtitle

    return SkeletonNode(
        date=best_date,
        title=best_title_node.title,
        subtitle=best_subtitle,
        significance=best_sig,
        description=best_desc,
        sources=all_sources,
    )


async def _merge_and_dedup(nodes: list[SkeletonNode], language: str) -> list[SkeletonNode]:
    sorted_nodes = sorted(nodes, key=lambda n: n.date)

    year_groups = _group_by_year(sorted_nodes)

    all_dup_groups: list[list[int]] = []
    async with asyncio.TaskGroup() as tg:
        tasks = [tg.create_task(_dedup_year_group(group)) for group in year_groups.values()]
    for task in tasks:
        all_dup_groups.extend(task.result())

    merged_away: set[int] = set()
    replacements: dict[int, SkeletonNode] = {}
    for group_indices in all_dup_groups:
        if len(group_indices) < 2:
            continue
        # winner_idx only determines position in the final list (first in group).
        # Actual title/date/etc selection is handled by _merge_duplicate_group.
        winner_idx = group_indices[0]
        merged_node = _merge_duplicate_group(sorted_nodes, group_indices, language)
        replacements[winner_idx] = merged_node
        merged_away.update(group_indices[1:])

    result: list[SkeletonNode] = []
    for i, node in enumerate(sorted_nodes):
        if i in merged_away:
            continue
        if i in replacements:
            result.append(replacements[i])
        else:
            result.append(node)

    return result


# --- Hallucination filter ---

_hallucination_agent = Agent(
    resolve_model(settings.hallucination_model),
    output_type=HallucinationCheckResult,
    instructions="""\
You are a fact-checking specialist. You will receive a list of recent \
timeline events (from 2025 onward) along with their search reference materials.

Your job: determine which events have NO evidence of actually having occurred \
in the search references.

Rules:
- An event is VERIFIED if the search references contain reports of it \
actually happening
- An event is UNVERIFIED (should be removed) if:
  - The search references only contain predictions, forecasts, or speculation
  - The search references do not mention it at all
  - The search references describe it as a future plan, not a completed event
- When in doubt, keep the event (false negatives are better than false positives)
- Return remove_ids as the list of node IDs to remove
- Return reasons mapping each removed node ID to a brief explanation""",
    retries=1,
)


class Orchestrator:
    def __init__(self, tavily: TavilyService) -> None:
        self.tavily = tavily
        self._detail_contexts: dict[str, str] = {}

    async def create_proposal(self, request: ResearchRequest) -> ResearchProposal:
        language = _normalize_language(request.language)
        if language:
            prompt = (
                f"请评估以下调研主题并生成调研提案：{request.topic}\n\n"
                f'要求：所有文本字段使用 {language} 输出。设置 language 字段为 "{language}"。'
            )
        else:
            prompt = f"请评估以下调研主题并生成调研提案：{request.topic}"
        result = await _proposal_agent.run(prompt)
        proposal = result.output
        if language:
            proposal = proposal.model_copy(update={"language": language})
        return proposal

    async def _run_milestone_phase(self, proposal: ResearchProposal) -> list[dict]:
        raw_nodes: list[SkeletonNode] = []

        async def _run_thread(thread: ResearchThread) -> list[SkeletonNode]:
            try:
                milestone_result, urls = await run_milestone_agent(
                    topic=proposal.topic,
                    thread_name=thread.name,
                    thread_description=thread.description,
                    estimated_nodes=thread.estimated_nodes,
                    language=proposal.language,
                    tavily=self.tavily,
                )
                for node in milestone_result.nodes:
                    node.sources = urls
                return milestone_result.nodes
            except Exception:
                logger.warning("Milestone agent failed for thread: %s", thread.name)
                return []

        async with asyncio.TaskGroup() as tg:
            tasks = [tg.create_task(_run_thread(thread)) for thread in proposal.research_threads]

        for task in tasks:
            raw_nodes.extend(task.result())

        merged = await _merge_and_dedup(raw_nodes, proposal.language)

        nodes: list[dict] = []
        for i, node in enumerate(merged, start=1):
            nodes.append(
                {
                    "id": f"ms_{i:03d}",
                    **node.model_dump(),
                    "status": "skeleton",
                }
            )
        return nodes

    async def _filter_hallucinations(self, nodes: list[dict]) -> list[dict]:
        recent = [n for n in nodes if n["date"] >= "2025"]
        if not recent:
            return nodes

        lines = []
        for node in recent:
            ctx = self._detail_contexts.get(node["id"], "No search results.")
            lines.append(
                f"--- Node {node['id']}: {node['title']} ({node['date']}) ---\n"
                f"Description: {node['description']}\n"
                f"Search references:\n{ctx}\n"
            )
        prompt = "Check these recent events:\n\n" + "\n".join(lines)

        try:
            result = await _hallucination_agent.run(prompt)
            remove_ids = set(result.output.remove_ids)
            if remove_ids:
                for nid, reason in result.output.reasons.items():
                    logger.info("Removing hallucinated node %s: %s", nid, reason)
            return [n for n in nodes if n["id"] not in remove_ids]
        except Exception:
            logger.warning("Hallucination check failed, keeping all nodes")
            return nodes
        finally:
            self._detail_contexts.clear()

    async def _run_gap_analysis(
        self,
        nodes: list[dict],
        proposal: ResearchProposal,
    ) -> GapAnalysisResult:
        try:
            return await run_gap_analysis_agent(
                topic=proposal.topic,
                language=proposal.language,
                nodes=nodes,
            )
        except Exception:
            logger.warning("Gap analysis failed, skipping")
            return GapAnalysisResult(gap_nodes=[], connections=[])

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

            nodes = await self._run_milestone_phase(proposal)

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
                        detail, search_context = await run_detail_agent(
                            node=node,
                            topic=proposal.topic,
                            language=proposal.language,
                            tavily=self.tavily,
                        )
                    except Exception:
                        logger.warning("Detail agent failed for node %s", node["id"])
                        return
                detail_completed += 1
                node["details"] = detail.model_dump()
                if node["date"] >= "2025":
                    self._detail_contexts[node["id"]] = search_context
                await session.push(
                    SSEEventType.NODE_DETAIL,
                    {
                        "node_id": node["id"],
                        "details": node["details"],
                    },
                )

            async with asyncio.TaskGroup() as tg:
                for node in nodes:
                    tg.create_task(_enrich_node(node))

            # --- Phase 3: Gap Analysis ---
            await session.push(
                SSEEventType.PROGRESS,
                {
                    "phase": "analysis",
                    "message": _get_progress_message("analysis", proposal.language),
                    "percent": 0,
                },
            )

            # Step 3a: Hallucination filter
            nodes = await self._filter_hallucinations(nodes)

            # Step 3b: Gap analysis + connections
            gap_result = await self._run_gap_analysis(nodes, proposal)
            gap_connections = gap_result.connections

            # Step 3c: Integrate gap nodes + push updated skeleton
            new_nodes: list[dict] = []
            if gap_result.gap_nodes:
                max_id = max(int(n["id"].split("_")[1]) for n in nodes)
                next_id = max_id + 1
                for gap_node in gap_result.gap_nodes:
                    node_dict = {
                        "id": f"ms_{next_id:03d}",
                        **gap_node.model_dump(),
                        "status": "skeleton",
                        "is_gap_node": True,
                    }
                    next_id += 1
                    new_nodes.append(node_dict)
                nodes.extend(new_nodes)
                nodes.sort(key=lambda n: n["date"])

            # Always push updated skeleton (reflects filtered + gap nodes)
            await session.push(SSEEventType.SKELETON, {"nodes": nodes})

            # Enrich gap nodes
            if new_nodes:
                async with asyncio.TaskGroup() as tg:
                    for node in new_nodes:
                        tg.create_task(_enrich_node(node))

            total = len(nodes)

            # --- Phase 4: Synthesis ---
            await session.push(
                SSEEventType.PROGRESS,
                {
                    "phase": "synthesis",
                    "message": _get_progress_message("synthesis", proposal.language),
                    "percent": 0,
                },
            )

            all_sources: set[str] = set()
            for node in nodes:
                all_sources.update(node.get("sources", []))
                if details := node.get("details"):
                    all_sources.update(details.get("sources", []))
            source_count = len(all_sources)

            synthesis_data: dict | None = None
            try:
                synthesis = await run_synthesizer_agent(
                    topic=proposal.topic,
                    language=proposal.language,
                    nodes=nodes,
                )
                synthesis_data = synthesis.model_dump()
                synthesis_data["source_count"] = source_count
                synthesis_data["connections"] = [c.model_dump() for c in gap_connections]
                await session.push(SSEEventType.SYNTHESIS, synthesis_data)
            except Exception:
                logger.warning("Synthesizer failed, skipping synthesis")

            # --- Complete ---
            await session.push(
                SSEEventType.COMPLETE,
                {
                    "total_nodes": total,
                    "detail_completed": detail_completed,
                },
            )
            session.status = SessionStatus.COMPLETED

            # --- Save to DB ---
            if async_session_factory is not None:
                try:
                    async with async_session_factory() as db:
                        await save_research(
                            db,
                            proposal=proposal,
                            nodes=nodes,
                            synthesis_data=synthesis_data,
                            total_nodes=total,
                            source_count=source_count,
                        )
                    logger.info("Saved research to DB: %s", proposal.topic)
                except Exception:
                    logger.exception("Failed to save research to DB")

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
