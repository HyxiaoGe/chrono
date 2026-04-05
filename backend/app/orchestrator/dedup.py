from __future__ import annotations

import asyncio
import logging
import re
from datetime import date

from pydantic import BaseModel
from pydantic_ai import Agent

from app.config import settings
from app.models.research import Significance, SkeletonNode
from app.models.runtime import RuntimeTimelineNode
from app.services.llm import resolve_model

logger = logging.getLogger(__name__)

_SIG_RANK = {
    Significance.MEDIUM: 0,
    Significance.HIGH: 1,
    Significance.REVOLUTIONARY: 2,
}
_YEAR_GROUP_MAX = 12


class DedupGroup(BaseModel):
    indices: list[int]


class DedupResult(BaseModel):
    duplicate_groups: list[DedupGroup]


_dedup_agent = Agent(
    resolve_model(settings.dedup_model),
    output_type=DedupResult,
    instructions="""\
You are a dedup specialist. Given a list of timeline events \
(with index, date, title, description), \
identify groups of events that refer to the SAME real-world event.

Rules:
- Two events are duplicates if they describe the same real-world occurrence, \
even if titles are in different languages or worded differently
- Date proximity matters: events more than 365 days apart are almost certainly NOT duplicates
- Pay extra attention to events within 7 days of each other whose titles share \
key terms — these are very likely duplicates even if worded differently
- Return only groups with 2+ items. Events with no duplicate should NOT appear in any group
- Each event index should appear in at most one group
- Output an empty duplicate_groups list if there are no duplicates""",
    retries=1,
)

_NORMALIZE_RE = re.compile(r"\s+")


def _normalize_title(title: str) -> str:
    return _NORMALIZE_RE.sub(" ", title.strip().lower())


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


def _split_large_groups(
    groups: dict[str, list[tuple[int, SkeletonNode]]],
) -> list[list[tuple[int, SkeletonNode]]]:
    result: list[list[tuple[int, SkeletonNode]]] = []
    for items in groups.values():
        if len(items) <= _YEAR_GROUP_MAX:
            result.append(items)
            continue

        first_half: list[tuple[int, SkeletonNode]] = []
        second_half: list[tuple[int, SkeletonNode]] = []
        for idx, node in items:
            try:
                month = date.fromisoformat(node.date).month
            except ValueError:
                month = 1
            (first_half if month <= 6 else second_half).append((idx, node))
        if first_half:
            result.append(first_half)
        if second_half:
            result.append(second_half)
    return result


async def _dedup_year_group(
    nodes_with_idx: list[tuple[int, SkeletonNode]],
) -> list[list[int]]:
    if len(nodes_with_idx) < 2:
        return []

    lines = [
        f"[{orig_idx}] {node.date} | {node.title} | {node.description[:80]}"
        for orig_idx, node in nodes_with_idx
    ]
    prompt = "Find duplicate events:\n" + "\n".join(lines)

    try:
        result = await _dedup_agent.run(prompt)
        return [group.indices for group in result.output.duplicate_groups]
    except Exception:
        logger.warning("Dedup agent failed for year group, skipping dedup")
        return []


def _pick_language_matching(nodes: list[SkeletonNode], language: str) -> SkeletonNode:
    if language in ("zh", "ja", "ko"):
        for node in nodes:
            if any("\u4e00" <= ch <= "\u9fff" for ch in node.title):
                return node
    return max(nodes, key=lambda node: len(node.title))


def _pick_precise_date(nodes: list[SkeletonNode]) -> str:
    for node in nodes:
        if not node.date.endswith("-01-01"):
            return node.date
    return nodes[0].date


def _merge_duplicate_group(
    nodes: list[SkeletonNode], indices: list[int], language: str
) -> SkeletonNode:
    group = [nodes[index] for index in indices]
    best_title_node = _pick_language_matching(group, language)
    best_sig = max(group, key=lambda node: _SIG_RANK.get(node.significance, 0)).significance
    best_desc = max(group, key=lambda node: len(node.description)).description
    all_sources = list({url for node in group for url in node.sources})
    best_date = _pick_precise_date(group)
    best_subtitle = max(group, key=lambda node: len(node.subtitle)).subtitle

    return SkeletonNode(
        date=best_date,
        title=best_title_node.title,
        subtitle=best_subtitle,
        significance=best_sig,
        description=best_desc,
        sources=all_sources,
    )


def _exact_title_dedup(nodes: list[SkeletonNode], language: str) -> list[SkeletonNode]:
    title_groups: dict[str, list[int]] = {}
    for index, node in enumerate(nodes):
        title_groups.setdefault(_normalize_title(node.title), []).append(index)

    merged_away: set[int] = set()
    replacements: dict[int, SkeletonNode] = {}
    exact_merged = 0
    for indices in title_groups.values():
        if len(indices) < 2:
            continue
        winner_idx = indices[0]
        replacements[winner_idx] = _merge_duplicate_group(nodes, indices, language)
        merged_away.update(indices[1:])
        exact_merged += len(indices) - 1

    if exact_merged:
        logger.info("Layer 1 exact title dedup: merged %d nodes", exact_merged)

    result: list[SkeletonNode] = []
    for index, node in enumerate(nodes):
        if index in merged_away:
            continue
        result.append(replacements.get(index, node))
    return result


def _apply_llm_dedup_groups(
    nodes: list[SkeletonNode],
    dup_groups: list[list[int]],
    language: str,
) -> list[SkeletonNode]:
    merged_away: set[int] = set()
    replacements: dict[int, SkeletonNode] = {}
    for group_indices in dup_groups:
        if len(group_indices) < 2:
            continue
        winner_idx = group_indices[0]
        replacements[winner_idx] = _merge_duplicate_group(nodes, group_indices, language)
        merged_away.update(group_indices[1:])

    result: list[SkeletonNode] = []
    for index, node in enumerate(nodes):
        if index in merged_away:
            continue
        result.append(replacements.get(index, node))
    return result


async def _llm_year_group_dedup(nodes: list[SkeletonNode], language: str) -> list[SkeletonNode]:
    sorted_nodes = sorted(nodes, key=lambda node: node.date)
    year_groups = _group_by_year(sorted_nodes)
    sub_groups = _split_large_groups(year_groups)

    all_dup_groups: list[list[int]] = []
    async with asyncio.TaskGroup() as tg:
        tasks = [tg.create_task(_dedup_year_group(group)) for group in sub_groups]
    for task in tasks:
        all_dup_groups.extend(task.result())

    llm_merged = sum(len(group) - 1 for group in all_dup_groups if len(group) >= 2)
    if llm_merged:
        logger.info("Layer 2 LLM year-group dedup: merged %d nodes", llm_merged)

    return _apply_llm_dedup_groups(sorted_nodes, all_dup_groups, language)


async def _boundary_scan_dedup(nodes: list[SkeletonNode], language: str) -> list[SkeletonNode]:
    sorted_nodes = sorted(nodes, key=lambda node: node.date)
    year_groups = _group_by_year(sorted_nodes)
    years = sorted(year for year in year_groups if year != "unknown")

    if len(years) < 2:
        return sorted_nodes

    boundary_pairs: list[list[tuple[int, SkeletonNode]]] = []
    for first, second in zip(years, years[1:], strict=False):
        candidate = year_groups[first][-3:] + year_groups[second][:3]
        if len(candidate) >= 2:
            boundary_pairs.append(candidate)

    if not boundary_pairs:
        return sorted_nodes

    all_dup_groups: list[list[int]] = []
    async with asyncio.TaskGroup() as tg:
        tasks = [tg.create_task(_dedup_year_group(pair)) for pair in boundary_pairs]
    for task in tasks:
        all_dup_groups.extend(task.result())

    boundary_merged = sum(len(group) - 1 for group in all_dup_groups if len(group) >= 2)
    if boundary_merged:
        logger.info("Layer 3 boundary scan dedup: merged %d nodes", boundary_merged)

    return _apply_llm_dedup_groups(sorted_nodes, all_dup_groups, language)


async def merge_and_dedup_skeleton_nodes(
    nodes: list[SkeletonNode], language: str
) -> list[SkeletonNode]:
    sorted_nodes = sorted(nodes, key=lambda node: node.date)
    after_exact = _exact_title_dedup(sorted_nodes, language)
    after_llm = await _llm_year_group_dedup(after_exact, language)
    return await _boundary_scan_dedup(after_llm, language)


async def merge_and_dedup_runtime_nodes(
    nodes: list[RuntimeTimelineNode],
    language: str,
) -> list[RuntimeTimelineNode]:
    source_by_key: dict[tuple[str, str], RuntimeTimelineNode] = {
        (node.date, _normalize_title(node.title)): node for node in nodes
    }
    skeleton_nodes = [
        SkeletonNode(
            date=node.date,
            title=node.title,
            subtitle=node.subtitle,
            significance=node.significance,
            description=node.description,
            sources=node.sources,
        )
        for node in nodes
    ]
    deduped = await merge_and_dedup_skeleton_nodes(skeleton_nodes, language)
    result: list[RuntimeTimelineNode] = []
    for index, node in enumerate(deduped, start=1):
        source = source_by_key.get((node.date, _normalize_title(node.title)))
        result.append(
            RuntimeTimelineNode.from_skeleton(
                node,
                node_id=f"ms_{index:03d}",
                phase_name=source.phase_name if source else None,
                is_gap_node=source.is_gap_node if source else False,
            )
        )
    return result
