import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { areDetailPanelPropsEqual } from "../src/utils/detailPanelMemo.ts";

const node = {
  id: "n1",
  date: "2007-01-09",
  title: "iPhone announced",
  subtitle: "Apple",
  significance: "revolutionary",
  description: "Apple announced the first iPhone.",
  sources: [],
  status: "complete",
};

const connectionMap = new Map();
const onClose = () => {};
const onNavigateToNode = () => {};

function props(overrides = {}) {
  return {
    node,
    language: "en",
    connectionMap,
    onClose,
    onNavigateToNode,
    ...overrides,
  };
}

describe("areDetailPanelPropsEqual", () => {
  it("skips rendering when detail panel inputs are unchanged", () => {
    assert.equal(areDetailPanelPropsEqual(props(), props()), true);
  });

  it("rerenders when content inputs change", () => {
    assert.equal(areDetailPanelPropsEqual(props(), props({ node: { ...node } })), false);
    assert.equal(areDetailPanelPropsEqual(props(), props({ language: "zh" })), false);
    assert.equal(
      areDetailPanelPropsEqual(props(), props({ connectionMap: new Map() })),
      false,
    );
  });

  it("rerenders when callbacks change", () => {
    assert.equal(areDetailPanelPropsEqual(props(), props({ onClose: () => {} })), false);
    assert.equal(
      areDetailPanelPropsEqual(props(), props({ onNavigateToNode: () => {} })),
      false,
    );
  });
});
