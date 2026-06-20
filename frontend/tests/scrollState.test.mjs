import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readPageScrollState } from "../src/utils/scrollState.ts";

describe("readPageScrollState", () => {
  it("reads scroll position, document height, and viewport height", () => {
    const state = readPageScrollState(
      { scrollY: 240, innerHeight: 900 },
      { documentElement: { scrollHeight: 3200 } },
    );

    assert.deepEqual(state, {
      scrollTop: 240,
      scrollHeight: 3200,
      viewportHeight: 900,
    });
  });
});
