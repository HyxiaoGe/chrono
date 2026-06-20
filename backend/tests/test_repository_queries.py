from __future__ import annotations

import uuid
from typing import Any

import pytest

from app.db.repository import (
    get_cached_research_proposal_by_id,
    get_cached_research_proposal_by_topic,
    get_nodes_for_research_replay,
    get_research_id_by_topic,
    get_research_replay_metadata,
    list_cached_topic_normalized,
    list_researches,
    save_research,
)
from app.models.research import ResearchProposal


class FakeScalarResult:
    def __init__(self, rows: list[Any]) -> None:
        self._rows = rows

    def all(self) -> list[Any]:
        return self._rows

    def first(self) -> Any | None:
        return self._rows[0] if self._rows else None


class FakeExecuteResult:
    def __init__(self, rows: list[Any]) -> None:
        self._rows = rows

    def all(self) -> list[Any]:
        return self._rows

    def scalars(self) -> FakeScalarResult:
        return FakeScalarResult(self._rows)

    def first(self) -> Any | None:
        return self._rows[0] if self._rows else None

    def scalar_one_or_none(self) -> Any | None:
        return self._rows[0] if self._rows else None


class CapturingSession:
    def __init__(
        self,
        rows: list[Any] | None = None,
        *,
        execute_rows: list[list[Any]] | None = None,
    ) -> None:
        self.rows = rows or []
        self.execute_rows = list(execute_rows) if execute_rows is not None else None
        self.statements = []
        self.statement = None
        self.added: list[Any] = []
        self.flush_count = 0
        self.commit_count = 0

    async def execute(self, statement):
        self.statements.append(statement)
        self.statement = statement
        rows = self.rows
        if self.execute_rows is not None:
            rows = self.execute_rows.pop(0)
        return FakeExecuteResult(rows)

    def add(self, row: Any) -> None:
        self.added.append(row)

    async def flush(self) -> None:
        self.flush_count += 1

    async def commit(self) -> None:
        self.commit_count += 1


def compile_sql(statement) -> str:
    return str(statement.compile(compile_kwargs={"literal_binds": True}))


def selected_column_keys(statement) -> set[str]:
    return {column.key for column in statement.selected_columns}


RESEARCH_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")
RESEARCH_ID_SQL = "'00000000000000000000000000000001'"


def make_proposal() -> ResearchProposal:
    return ResearchProposal.model_validate(
        {
            "topic": "iPhone",
            "topic_type": "product",
            "language": "en",
            "complexity": {
                "level": "light",
                "time_span": "2007-2026",
                "parallel_threads": 1,
                "estimated_total_nodes": 1,
                "reasoning": "single product line",
            },
            "research_threads": [
                {
                    "name": "Product launches",
                    "description": "Major launches",
                    "priority": 5,
                    "estimated_nodes": 1,
                }
            ],
            "estimated_duration": {"min_seconds": 90, "max_seconds": 180},
            "credits_cost": 1,
            "user_facing": {
                "title": "History of iPhone",
                "summary": "Timeline of iPhone development.",
                "duration_text": "about 2 minutes",
                "credits_text": "1 credit",
                "thread_names": ["Product launches"],
            },
        }
    )


@pytest.mark.asyncio
async def test_cached_research_proposal_lookup_selects_only_proposal_payload() -> None:
    session = CapturingSession()

    await get_cached_research_proposal_by_topic(session, "iPhone")

    assert len(session.statements) == 2
    exact_sql = compile_sql(session.statements[0])
    fuzzy_sql = compile_sql(session.statements[1])
    for statement in session.statements:
        assert selected_column_keys(statement) == {"id", "proposal"}
    assert "researches.topic_normalized = 'iphone'" in exact_sql
    assert "researches.topic_normalized LIKE '%' || 'iphone' || '%'" in fuzzy_sql
    assert "researches.synthesis" not in exact_sql
    assert "researches.synthesis" not in fuzzy_sql


@pytest.mark.asyncio
async def test_cached_research_proposal_lookup_by_id_selects_only_proposal_payload() -> None:
    session = CapturingSession()

    await get_cached_research_proposal_by_id(session, RESEARCH_ID)

    sql = compile_sql(session.statement)
    assert selected_column_keys(session.statement) == {"id", "proposal"}
    assert f"researches.id = {RESEARCH_ID_SQL}" in sql
    assert "researches.synthesis" not in sql
    assert "researches.topic" not in sql


@pytest.mark.asyncio
async def test_research_id_lookup_selects_only_id() -> None:
    session = CapturingSession()

    await get_research_id_by_topic(session, "iPhone")

    assert len(session.statements) == 2
    exact_sql = compile_sql(session.statements[0])
    fuzzy_sql = compile_sql(session.statements[1])
    for statement in session.statements:
        assert selected_column_keys(statement) == {"id"}
    assert "researches.topic_normalized = 'iphone'" in exact_sql
    assert "researches.topic_normalized LIKE '%' || 'iphone' || '%'" in fuzzy_sql
    assert "researches.proposal" not in exact_sql
    assert "researches.synthesis" not in exact_sql
    assert "researches.proposal" not in fuzzy_sql
    assert "researches.synthesis" not in fuzzy_sql


@pytest.mark.asyncio
async def test_save_research_updates_existing_row_without_loading_full_research() -> None:
    session = CapturingSession(execute_rows=[[RESEARCH_ID], [], []])

    research_id = await save_research(
        session,
        proposal=make_proposal(),
        nodes=[
            {
                "id": "ms_001",
                "date": "2007-01-09",
                "title": "iPhone announced",
                "subtitle": "Apple",
                "significance": "revolutionary",
                "description": "Apple announced the first iPhone.",
                "details": {"sources": ["https://example.com"]},
                "phase_name": "Launch",
            }
        ],
        synthesis_data={"summary": "iPhone changed smartphones."},
        total_nodes=1,
        source_count=1,
    )

    lookup_sql = compile_sql(session.statements[0])
    update_sql = str(session.statements[1])
    delete_sql = compile_sql(session.statements[2])
    assert research_id == RESEARCH_ID
    assert selected_column_keys(session.statements[0]) == {"id"}
    assert "researches.proposal" not in lookup_sql
    assert "researches.synthesis" not in lookup_sql
    assert update_sql.startswith("UPDATE researches SET")
    assert f"timeline_nodes.research_id = {RESEARCH_ID_SQL}" in delete_sql
    assert session.added[0].research_id == RESEARCH_ID
    assert session.flush_count == 1
    assert session.commit_count == 1


@pytest.mark.asyncio
async def test_replay_metadata_lookup_selects_only_replay_fields() -> None:
    session = CapturingSession()

    await get_research_replay_metadata(session, RESEARCH_ID)

    sql = compile_sql(session.statement)
    assert selected_column_keys(session.statement) == {"synthesis", "total_nodes"}
    assert f"researches.id = {RESEARCH_ID_SQL}" in sql
    assert "researches.proposal" not in sql
    assert "researches.topic" not in sql


@pytest.mark.asyncio
async def test_replay_nodes_lookup_selects_only_replay_fields() -> None:
    session = CapturingSession()

    await get_nodes_for_research_replay(session, RESEARCH_ID)

    sql = compile_sql(session.statement)
    assert selected_column_keys(session.statement) == {
        "node_id",
        "date",
        "title",
        "subtitle",
        "significance",
        "description",
        "details",
        "is_gap_node",
        "phase_name",
    }
    assert f"timeline_nodes.research_id = {RESEARCH_ID_SQL}" in sql
    assert "timeline_nodes.sort_order" in sql
    assert "timeline_nodes.created_at" not in sql


@pytest.mark.asyncio
async def test_list_researches_pushes_locale_and_limit_into_query() -> None:
    session = CapturingSession()

    await list_researches(session, locale="zh", limit=12)

    sql = compile_sql(session.statement)
    assert "researches.language LIKE 'zh%'" in sql
    assert "LIMIT 12" in sql
    assert "researches.proposal" not in sql
    assert "synthesis" not in selected_column_keys(session.statement)
    assert {"timeline_span", "key_insight"}.issubset(selected_column_keys(session.statement))


@pytest.mark.asyncio
async def test_list_cached_topic_normalized_selects_only_normalized_topics() -> None:
    session = CapturingSession(["history of iphone", "world war ii"])

    rows = await list_cached_topic_normalized(session, candidates={"iphone", "world war ii"})

    sql = compile_sql(session.statement)
    assert rows == ["history of iphone", "world war ii"]
    assert "researches.topic_normalized" in sql
    assert "researches.topic_normalized LIKE '%' || 'iphone' || '%'" in sql
    assert "'iphone' LIKE '%' || researches.topic_normalized || '%'" in sql
    assert "researches.proposal" not in sql
    assert "researches.synthesis" not in sql
