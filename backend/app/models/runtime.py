from __future__ import annotations

from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field

from app.models.research import (
    NodeDetail,
    ResearchProposal,
    Significance,
    SkeletonNode,
    TimelineConnection,
)


class RuntimeNodeStatus(StrEnum):
    SKELETON = "skeleton"
    LOADING = "loading"
    COMPLETE = "complete"


class RuntimeTimelineNode(BaseModel):
    id: str
    date: str
    title: str
    subtitle: str = ""
    significance: Significance
    description: str
    sources: list[str] = Field(default_factory=list)
    status: RuntimeNodeStatus = RuntimeNodeStatus.SKELETON
    details: NodeDetail | None = None
    phase_name: str | None = None
    is_gap_node: bool = False

    @classmethod
    def from_skeleton(
        cls,
        node: SkeletonNode,
        *,
        node_id: str,
        status: RuntimeNodeStatus = RuntimeNodeStatus.SKELETON,
        phase_name: str | None = None,
        is_gap_node: bool = False,
    ) -> RuntimeTimelineNode:
        return cls(
            id=node_id,
            date=node.date,
            title=node.title,
            subtitle=node.subtitle,
            significance=node.significance,
            description=node.description,
            sources=list(node.sources),
            status=status,
            phase_name=phase_name,
            is_gap_node=is_gap_node,
        )

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> RuntimeTimelineNode:
        payload = dict(data)
        if details := payload.get("details"):
            payload["details"] = NodeDetail.model_validate(details)
        return cls.model_validate(payload)

    def to_sse_dict(self) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "id": self.id,
            "date": self.date,
            "title": self.title,
            "subtitle": self.subtitle,
            "significance": self.significance,
            "description": self.description,
            "sources": list(self.sources),
            "status": self.status.value,
        }
        if self.details is not None:
            payload["details"] = self.details.model_dump()
        if self.phase_name:
            payload["phase_name"] = self.phase_name
        if self.is_gap_node:
            payload["is_gap_node"] = True
        return payload

    def to_db_dict(self) -> dict[str, Any]:
        payload = self.to_sse_dict()
        if self.details is not None:
            payload["details"] = self.details.model_dump()
        return payload

    def with_details(self, details: NodeDetail) -> RuntimeTimelineNode:
        return self.model_copy(update={"details": details, "status": RuntimeNodeStatus.COMPLETE})

    def with_date(self, corrected_date: str) -> RuntimeTimelineNode:
        return self.model_copy(update={"date": corrected_date})


class RuntimeResearchState(BaseModel):
    proposal: ResearchProposal
    nodes: list[RuntimeTimelineNode] = Field(default_factory=list)
    detail_contexts: dict[str, str] = Field(default_factory=dict)
    gap_connections: list[TimelineConnection] = Field(default_factory=list)
    synthesis_data: dict[str, Any] | None = None
    detail_completed: int = 0

    def sorted_nodes(self) -> list[RuntimeTimelineNode]:
        return sorted(self.nodes, key=lambda node: node.date)

    def next_node_id(self, prefix: str = "ms_") -> str:
        numeric_ids = []
        for node in self.nodes:
            try:
                numeric_ids.append(int(node.id.split("_")[1]))
            except (IndexError, ValueError):
                continue
        next_id = max(numeric_ids, default=0) + 1
        return f"{prefix}{next_id:03d}"
