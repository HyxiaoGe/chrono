import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { areNodeCardPropsEqual } from "../src/utils/nodeCardMemo.ts";

const node = {
  id: "ms_001",
  date: "2007-01-09",
  title: "iPhone announced",
  subtitle: "Apple",
  significance: "revolutionary",
  description: "Apple announced the first iPhone.",
  sources: [],
  status: "complete",
};

const onClick = () => {};
const onHover = () => {};

function props(overrides = {}) {
  return {
    node,
    isSelected: false,
    isRelated: false,
    dimmed: false,
    onClick,
    onHover,
    side: "left",
    ...overrides,
  };
}

describe("areNodeCardPropsEqual", () => {
  it("skips rendering when node identity and visual props are unchanged", () => {
    assert.equal(areNodeCardPropsEqual(props(), props()), true);
  });

  it("rerenders when node identity changes", () => {
    assert.equal(
      areNodeCardPropsEqual(props(), props({ node: { ...node, title: "Updated" } })),
      false,
    );
  });

  it("rerenders when hover-derived visual state changes", () => {
    assert.equal(areNodeCardPropsEqual(props(), props({ dimmed: true })), false);
    assert.equal(areNodeCardPropsEqual(props(), props({ isRelated: true })), false);
  });

  it("rerenders when callbacks change", () => {
    assert.equal(areNodeCardPropsEqual(props(), props({ onHover: () => {} })), false);
  });
});
