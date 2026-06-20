import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { areSearchSectionPropsEqual } from "../src/utils/searchSectionMemo.ts";

const onSelectTopic = () => {};

function props(overrides = {}) {
  return {
    onSelectTopic,
    locale: "zh",
    disabled: false,
    ...overrides,
  };
}

describe("areSearchSectionPropsEqual", () => {
  it("skips rendering when search section inputs are unchanged", () => {
    assert.equal(areSearchSectionPropsEqual(props(), props()), true);
  });

  it("rerenders when locale, disabled state, or selection callback changes", () => {
    assert.equal(areSearchSectionPropsEqual(props(), props({ locale: "en" })), false);
    assert.equal(areSearchSectionPropsEqual(props(), props({ disabled: true })), false);
    assert.equal(
      areSearchSectionPropsEqual(props(), props({ onSelectTopic: () => {} })),
      false,
    );
  });
});
