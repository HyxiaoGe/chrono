from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, Field


class TopicType(StrEnum):
    PRODUCT = "product"
    TECHNOLOGY = "technology"
    CULTURE = "culture"
    HISTORICAL_EVENT = "historical_event"


class ComplexityLevel(StrEnum):
    LIGHT = "light"
    MEDIUM = "medium"
    DEEP = "deep"
    EPIC = "epic"


class ResearchThread(BaseModel):
    name: str
    description: str
    priority: int = Field(ge=1, le=5)
    estimated_nodes: int


class DurationEstimate(BaseModel):
    min_seconds: int
    max_seconds: int


class ComplexityAssessment(BaseModel):
    level: ComplexityLevel
    time_span: str
    parallel_threads: int
    estimated_total_nodes: int
    reasoning: str


class UserFacingProposal(BaseModel):
    title: str
    summary: str
    duration_text: str
    credits_text: str
    thread_names: list[str]


class ResearchProposal(BaseModel):
    topic: str
    topic_type: TopicType
    language: str
    complexity: ComplexityAssessment
    research_threads: list[ResearchThread]
    estimated_duration: DurationEstimate
    credits_cost: int
    user_facing: UserFacingProposal


class ResearchRequest(BaseModel):
    topic: str
    language: str = "auto"


class ResearchProposalResponse(BaseModel):
    session_id: str
    proposal: ResearchProposal


class ErrorResponse(BaseModel):
    error: str
    message: str


# --- Milestone / Skeleton models ---


class Significance(StrEnum):
    REVOLUTIONARY = "revolutionary"
    HIGH = "high"
    MEDIUM = "medium"


class SkeletonNode(BaseModel):
    date: str
    title: str
    subtitle: str = ""
    significance: Significance
    description: str
    sources: list[str] = Field(default_factory=list)


class MilestoneResult(BaseModel):
    nodes: list[SkeletonNode]


# --- Detail models ---


class NodeDetail(BaseModel):
    key_features: list[str]
    impact: str
    key_people: list[str]
    context: str
    sources: list[str] = Field(default_factory=list)


# --- Phase 3: Gap Analysis models ---


class TimelineConnection(BaseModel):
    from_id: str
    to_id: str
    relationship: str
    type: Literal["caused", "enabled", "inspired", "responded_to"]


class GapAnalysisResult(BaseModel):
    gap_nodes: list[SkeletonNode]
    connections: list[TimelineConnection]


class HallucinationCheckResult(BaseModel):
    remove_ids: list[str]
    reasons: dict[str, str]


# --- Synthesis models ---


class SynthesisResult(BaseModel):
    summary: str
    key_insight: str
    timeline_span: str
    source_count: int = 0
    verification_notes: list[str] = Field(default_factory=list)
    connections: list[TimelineConnection] = Field(default_factory=list)


# --- SSE event types ---


class SSEEventType(StrEnum):
    PROGRESS = "progress"
    SKELETON = "skeleton"
    NODE_DETAIL = "node_detail"
    SYNTHESIS = "synthesis"
    COMPLETE = "complete"
    RESEARCH_ERROR = "research_error"
