import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { areTimelinePropsEqual } from "../src/utils/timelineMemo.ts";

const nodes = [{ id: "n1" }];
const connections = [{ from_id: "n1", to_id: "n2" }];
const onSelect = () => {};
const onHover = () => {};

function props(overrides = {}) {
  return {
    nodes,
    connections,
    selectedId: null,
    hoveredId: null,
    onSelect,
    onHover,
    ...overrides,
  };
}

describe("areTimelinePropsEqual", () => {
  it("skips timeline rendering when all props keep the same identity and value", () => {
    assert.equal(areTimelinePropsEqual(props(), props()), true);
  });

  it("rerenders when data, selection, hover, or callbacks change", () => {
    assert.equal(areTimelinePropsEqual(props(), props({ nodes: [...nodes] })), false);
    assert.equal(
      areTimelinePropsEqual(props(), props({ connections: [...connections] })),
      false,
    );
    assert.equal(areTimelinePropsEqual(props(), props({ selectedId: "n1" })), false);
    assert.equal(areTimelinePropsEqual(props(), props({ hoveredId: "n1" })), false);
    assert.equal(areTimelinePropsEqual(props(), props({ onSelect: () => {} })), false);
    assert.equal(areTimelinePropsEqual(props(), props({ onHover: () => {} })), false);
  });
});
