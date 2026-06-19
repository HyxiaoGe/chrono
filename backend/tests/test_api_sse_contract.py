from app.models.research import NodeDetail, ResearchProposal, Significance, SkeletonNode
from app.models.runtime import RuntimeNodeStatus, RuntimeTimelineNode


def test_research_proposal_contract_includes_research_phases() -> None:
    proposal = ResearchProposal.model_validate(
        {
            "topic": "World War II",
            "topic_type": "historical_event",
            "language": "en",
            "complexity": {
                "level": "epic",
                "time_span": "1933-1945",
                "parallel_threads": 4,
                "estimated_total_nodes": 90,
                "reasoning": "multi-phase historical topic",
            },
            "research_threads": [
                {
                    "name": "Military",
                    "description": "Military events",
                    "priority": 5,
                    "estimated_nodes": 40,
                }
            ],
            "research_phases": [
                {
                    "name": "Prelude",
                    "time_range": "1933-1939",
                    "description": "Events before the war",
                    "threads": [
                        {
                            "name": "Diplomacy",
                            "description": "Diplomatic events",
                            "priority": 4,
                            "estimated_nodes": 10,
                        }
                    ],
                }
            ],
            "estimated_duration": {"min_seconds": 300, "max_seconds": 480},
            "credits_cost": 5,
            "user_facing": {
                "title": "World War II Timeline",
                "summary": "A phased research timeline.",
                "duration_text": "about 5-8 minutes",
                "credits_text": "5 credits",
                "thread_names": ["Military"],
            },
        }
    )

    payload = proposal.model_dump()

    assert payload["research_phases"][0]["name"] == "Prelude"
    assert payload["research_phases"][0]["threads"][0]["name"] == "Diplomacy"


def test_runtime_node_sse_contract_includes_status_details_phase_and_gap_fields() -> None:
    node = RuntimeTimelineNode.from_skeleton(
        SkeletonNode(
            date="1941-12-07",
            title="Attack on Pearl Harbor",
            subtitle="Pacific War",
            significance=Significance.REVOLUTIONARY,
            description="Japan attacked Pearl Harbor.",
            sources=["https://example.com/source"],
        ),
        node_id="ms_001",
        status=RuntimeNodeStatus.LOADING,
        phase_name="Global War",
        is_gap_node=True,
    ).with_details(
        NodeDetail(
            key_features=["Surprise attack on the US Pacific Fleet"],
            impact="The attack brought the United States into World War II.",
            key_people=["Franklin D. Roosevelt — US President"],
            context="US-Japan tensions had escalated through 1941.",
            sources=["https://example.com/detail"],
            tags=["military", "diplomatic"],
        )
    )

    payload = node.to_sse_dict()

    assert payload["id"] == "ms_001"
    assert payload["status"] == "complete"
    assert payload["details"]["impact"].startswith("The attack brought")
    assert payload["phase_name"] == "Global War"
    assert payload["is_gap_node"] is True
