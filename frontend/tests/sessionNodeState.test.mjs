import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { deriveSessionNodeState } from "../src/utils/sessionNodeState.ts";

const nodes = [
  {
    id: "n1",
    date: "2007-01-09",
    title: "iPhone announced",
    phase_name: "Launch",
    status: "complete",
  },
  {
    id: "n2",
    date: "2008-07-10",
    title: "App Store launches",
    phase_name: "Platform",
    status: "loading",
  },
  {
    id: "n3",
    date: "2009-06-08",
    title: "iPhone 3GS",
    phase_name: "Platform",
    status: "complete",
  },
];

describe("deriveSessionNodeState", () => {
  it("derives node ids and completed count in one pass", () => {
    const state = deriveSessionNodeState(nodes, {
      activeNodeId: "n2",
      selectedNodeId: "n3",
    });

    assert.deepEqual(state.nodeIds, ["n1", "n2", "n3"]);
    assert.equal(state.completedNodeCount, 2);
    assert.equal(state.activeNode?.id, "n2");
    assert.equal(state.selectedNode?.id, "n3");
    assert.equal(state.activeYear, "2008");
    assert.equal(state.activePhase, "Platform");
  });

  it("returns null node references when ids are absent", () => {
    const state = deriveSessionNodeState(nodes, {
      activeNodeId: null,
      selectedNodeId: "missing",
    });

    assert.equal(state.activeNode, null);
    assert.equal(state.selectedNode, null);
    assert.equal(state.activeYear, null);
    assert.equal(state.activePhase, null);
  });
});
