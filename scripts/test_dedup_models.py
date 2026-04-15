"""
Dedup Model A/B Evaluation Script

Compares dedup quality between two models by running the same dedup pipeline
on skeleton data from completed researches stored in the DB.

Usage:
    cd backend
    uv run python ../scripts/test_dedup_models.py

Requires:
    - DATABASE_URL configured in .env
    - Provider API keys (DEEPSEEK_API_KEY, QWEN_API_KEY, etc.) configured in .env
    - At least one completed research in the DB

Output:
    - Console summary with per-topic comparison
    - Detailed report written to plans/dedup-model-evaluation.md
"""

from __future__ import annotations

import asyncio
import sys
import time
from pathlib import Path

# Add backend to path so we can import app modules
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from app.config import settings  # noqa: E402
from app.db.database import async_session_factory  # noqa: E402
from app.db.repository import get_nodes_for_research, list_researches  # noqa: E402
from app.models.research import Significance, SkeletonNode  # noqa: E402
from app.orchestrator.orchestrator import (  # noqa: E402
    _boundary_scan_dedup,
    _exact_title_dedup,
    _llm_year_group_dedup,
)
from app.services.llm import resolve_model  # noqa: E402

# --- Configuration ---

# Model A: current default
MODEL_A_NAME = settings.dedup_model
# Model B: candidate replacement
MODEL_B_NAME = "deepseek:deepseek-chat"

# Topics to test (will match by normalized topic)
TARGET_TOPICS = ["iphone", "人工智能", "二战"]


def _rows_to_skeleton_nodes(rows: list) -> list[SkeletonNode]:
    """Convert TimelineNodeRow list to SkeletonNode list."""
    nodes = []
    for row in rows:
        nodes.append(
            SkeletonNode(
                date=row.date,
                title=row.title,
                subtitle=row.subtitle or "",
                significance=Significance(row.significance),
                description=row.description,
                sources=[],
            )
        )
    return nodes


async def _run_dedup_pipeline(
    nodes: list[SkeletonNode],
    language: str,
    model_name: str,
) -> tuple[list[SkeletonNode], float]:
    """Run the full 3-layer dedup pipeline with a specific model.

    Temporarily patches the _dedup_agent's model for testing.
    Returns (deduped_nodes, elapsed_seconds).
    """
    from app.orchestrator.orchestrator import _dedup_agent

    # Resolve the test model
    test_model = resolve_model(model_name)

    # Layer 1: exact title dedup (no LLM, same for both models)
    sorted_nodes = sorted(nodes, key=lambda n: n.date)
    after_exact = _exact_title_dedup(sorted_nodes, language)

    # Layer 2 + 3: LLM dedup — run with model override
    # We need to temporarily swap the agent's model
    original_model = _dedup_agent.model
    _dedup_agent.model = test_model

    start = time.monotonic()
    try:
        after_llm = await _llm_year_group_dedup(after_exact, language)
        after_boundary = await _boundary_scan_dedup(after_llm, language)
    finally:
        _dedup_agent.model = original_model

    elapsed = time.monotonic() - start
    return after_boundary, elapsed


def _compare_results(
    original: list[SkeletonNode],
    result_a: list[SkeletonNode],
    result_b: list[SkeletonNode],
) -> dict:
    """Compare dedup results between two models."""
    titles_a = {n.title for n in result_a}
    titles_b = {n.title for n in result_b}

    # Nodes removed by A but not B
    only_a_removed = titles_b - titles_a
    # Nodes removed by B but not A
    only_b_removed = titles_a - titles_b
    # Nodes removed by both
    both_removed = {n.title for n in original} - titles_a - titles_b

    return {
        "original_count": len(original),
        "result_a_count": len(result_a),
        "result_b_count": len(result_b),
        "merged_by_a": len(original) - len(result_a),
        "merged_by_b": len(original) - len(result_b),
        "only_a_removed": sorted(only_a_removed),
        "only_b_removed": sorted(only_b_removed),
        "both_removed_count": len(both_removed),
    }


async def main() -> None:
    if not async_session_factory:
        print("ERROR: DATABASE_URL not configured. Set it in backend/.env")
        sys.exit(1)

    print(f"Model A: {MODEL_A_NAME}")
    print(f"Model B: {MODEL_B_NAME}")
    print()

    results: list[dict] = []

    async with async_session_factory() as session:
        researches = await list_researches(session)
        print(f"Found {len(researches)} completed researches in DB")

        for research in researches:
            topic_lower = research.topic.lower().strip()
            if topic_lower not in TARGET_TOPICS:
                continue

            print(f"\n{'=' * 60}")
            print(f"Topic: {research.topic} ({research.total_nodes} nodes)")
            print(f"{'=' * 60}")

            rows = await get_nodes_for_research(session, research.id)
            if not rows:
                print("  No nodes found, skipping")
                continue

            skeleton_nodes = _rows_to_skeleton_nodes(rows)
            language = research.language

            # Run Model A
            print(f"  Running Model A ({MODEL_A_NAME})...")
            try:
                result_a, time_a = await _run_dedup_pipeline(skeleton_nodes, language, MODEL_A_NAME)
                print(f"    Result: {len(skeleton_nodes)} → {len(result_a)} nodes ({time_a:.1f}s)")
            except Exception as e:
                print(f"    FAILED: {e}")
                result_a, time_a = skeleton_nodes, 0.0

            # Run Model B
            print(f"  Running Model B ({MODEL_B_NAME})...")
            try:
                result_b, time_b = await _run_dedup_pipeline(skeleton_nodes, language, MODEL_B_NAME)
                print(f"    Result: {len(skeleton_nodes)} → {len(result_b)} nodes ({time_b:.1f}s)")
            except Exception as e:
                print(f"    FAILED: {e}")
                result_b, time_b = skeleton_nodes, 0.0

            comparison = _compare_results(skeleton_nodes, result_a, result_b)
            comparison["topic"] = research.topic
            comparison["language"] = language
            comparison["time_a"] = round(time_a, 2)
            comparison["time_b"] = round(time_b, 2)
            results.append(comparison)

            print("  Comparison:")
            print(f"    Model A merged: {comparison['merged_by_a']} nodes")
            print(f"    Model B merged: {comparison['merged_by_b']} nodes")
            if comparison["only_a_removed"]:
                print(f"    Only A removed: {comparison['only_a_removed']}")
            if comparison["only_b_removed"]:
                print(f"    Only B removed: {comparison['only_b_removed']}")

    if not results:
        print("\nNo matching topics found in DB. Run researches for: iPhone, 人工智能, 二战")
        sys.exit(1)

    # Write report
    report_path = Path(__file__).resolve().parent.parent / "plans" / "dedup-model-evaluation.md"
    _write_report(results, report_path)
    print(f"\nReport written to: {report_path}")


def _write_report(results: list[dict], path: Path) -> None:
    lines = [
        "# Dedup Model Evaluation Report",
        "",
        f"**Model A**: `{MODEL_A_NAME}` (current default)",
        f"**Model B**: `{MODEL_B_NAME}` (candidate)",
        "",
        "---",
        "",
    ]

    for r in results:
        lines.extend(
            [
                f"## {r['topic']} ({r['language']})",
                "",
                "| Metric | Model A | Model B |",
                "|--------|---------|---------|",
                f"| Input nodes | {r['original_count']} | {r['original_count']} |",
                f"| Output nodes | {r['result_a_count']} | {r['result_b_count']} |",
                f"| Merged count | {r['merged_by_a']} | {r['merged_by_b']} |",
                f"| LLM time (s) | {r['time_a']} | {r['time_b']} |",
                "",
            ]
        )

        if r["only_a_removed"]:
            lines.append("**Only Model A removed:**")
            for title in r["only_a_removed"]:
                lines.append(f"- {title}")
            lines.append("")

        if r["only_b_removed"]:
            lines.append("**Only Model B removed:**")
            for title in r["only_b_removed"]:
                lines.append(f"- {title}")
            lines.append("")

        if not r["only_a_removed"] and not r["only_b_removed"]:
            lines.append("**Identical results** — both models removed the same nodes.")
            lines.append("")

        lines.append("---")
        lines.append("")

    # Summary
    lines.extend(
        [
            "## Summary",
            "",
            "| Topic | Model A merged | Model B merged | Difference | A time | B time |",
            "|-------|---------------|---------------|------------|--------|--------|",
        ]
    )
    for r in results:
        diff = r["merged_by_a"] - r["merged_by_b"]
        diff_str = f"+{diff}" if diff > 0 else str(diff)
        lines.append(
            f"| {r['topic']} | {r['merged_by_a']} | {r['merged_by_b']} "
            f"| {diff_str} | {r['time_a']}s | {r['time_b']}s |"
        )

    lines.extend(
        [
            "",
            "## Conclusion",
            "",
            "TODO: Fill in after running the evaluation.",
            "",
            "Factors to consider:",
            "- If merged counts are similar and no incorrect merges, Model B is viable",
            "- Check `only_X_removed` lists for quality (are the extra merges correct?)",
            "- Compare latency (Model B should be faster if using a lighter model)",
            "- Cost: each dedup call saves ~$X by switching from Model A to Model B",
        ]
    )

    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


if __name__ == "__main__":
    asyncio.run(main())
