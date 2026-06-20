import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { elapsedSecondsSince, formatElapsedSeconds } from "../src/utils/progressTime.ts";

describe("progressTime", () => {
  it("formats elapsed seconds as a compact timer", () => {
    assert.equal(formatElapsedSeconds(0), "0:00");
    assert.equal(formatElapsedSeconds(7), "0:07");
    assert.equal(formatElapsedSeconds(65), "1:05");
  });

  it("normalizes negative and fractional elapsed values", () => {
    assert.equal(formatElapsedSeconds(-3), "0:00");
    assert.equal(formatElapsedSeconds(7.8), "0:07");
  });

  it("computes elapsed seconds from a start timestamp", () => {
    assert.equal(elapsedSecondsSince(1_000, 2_999), 1);
    assert.equal(elapsedSecondsSince(3_000, 2_000), 0);
  });
});
