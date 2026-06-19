import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createInitialResearchEventsState,
  researchEventsReducer,
} from "../src/hooks/useResearchEventsReducer.ts";

function skeletonNode(overrides = {}) {
  return {
    id: "ms_001",
    date: "2007-01-09",
    title: "iPhone announced",
    subtitle: "Apple",
    significance: "revolutionary",
    description: "Apple announced the first iPhone.",
    sources: ["https://example.com/skeleton"],
    status: "skeleton",
    ...overrides,
  };
}

function detail(overrides = {}) {
  return {
    key_features: ["Multi-touch display"],
    impact: "It reshaped smartphones.",
    key_people: ["Steve Jobs"],
    context: "Apple entered the phone market.",
    sources: ["https://example.com/detail"],
    ...overrides,
  };
}

describe("researchEventsReducer", () => {
  it("marks skeleton nodes as loading when detail phase starts", () => {
    const state = createInitialResearchEventsState();
    const withSkeleton = researchEventsReducer(state, {
      type: "skeleton",
      data: { nodes: [skeletonNode()] },
    });

    const next = researchEventsReducer(withSkeleton, {
      type: "progress",
      data: {
        phase: "detail",
        message: "Enriching timeline details...",
        percent: 0,
        model: "DeepSeek",
      },
    });

    assert.equal(next.researchPhase, "detail");
    assert.equal(next.researchModel, "DeepSeek");
    assert.equal(next.nodes[0].status, "loading");
  });

  it("appends partial skeleton nodes chronologically and preserves gap metadata", () => {
    const state = createInitialResearchEventsState();

    const next = researchEventsReducer(state, {
      type: "skeleton",
      data: {
        partial: true,
        nodes: [
          skeletonNode({ id: "tmp_002", date: "2008-07-11" }),
          skeletonNode({
            id: "tmp_001",
            date: "2007-01-09",
            is_gap_node: true,
          }),
        ],
      },
    });

    assert.deepEqual(
      next.nodes.map((node) => node.id),
      ["tmp_001", "tmp_002"],
    );
    assert.equal(next.nodes[0].is_gap_node, true);
  });

  it("preserves existing details when a full skeleton update omits details", () => {
    const existingDetail = detail({ impact: "Existing impact." });
    const existingNode = {
      ...skeletonNode({ status: "complete" }),
      status: "complete",
      details: existingDetail,
    };
    const state = {
      ...createInitialResearchEventsState(),
      nodes: [existingNode],
    };

    const next = researchEventsReducer(state, {
      type: "skeleton",
      data: {
        nodes: [skeletonNode({ status: "complete", title: "Updated title" })],
      },
    });

    assert.equal(next.nodes[0].title, "Updated title");
    assert.equal(next.nodes[0].details?.impact, "Existing impact.");
    assert.equal(next.nodes[0].status, "complete");
  });

  it("completes a node when node detail arrives", () => {
    const state = researchEventsReducer(createInitialResearchEventsState(), {
      type: "skeleton",
      data: { nodes: [skeletonNode()] },
    });

    const next = researchEventsReducer(state, {
      type: "node_detail",
      data: { node_id: "ms_001", details: detail() },
    });

    assert.equal(next.nodes[0].status, "complete");
    assert.equal(next.nodes[0].details?.impact, "It reshaped smartphones.");
    assert.deepEqual(next.nodes[0].sources, [
      "https://example.com/skeleton",
      "https://example.com/detail",
    ]);
  });
});
