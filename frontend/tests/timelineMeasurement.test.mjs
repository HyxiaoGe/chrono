import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  areTimelineMeasurementsEqual,
  keepPreviousTimelineMeasurementIfEqual,
} from "../src/utils/timelineMeasurement.ts";

const current = {
  containerHeight: 800,
  positions: {
    a: { top: 120 },
    b: { top: 420 },
  },
};

describe("timeline measurement helpers", () => {
  it("treats equal heights and positions as the same measurement", () => {
    const next = {
      containerHeight: 800,
      positions: {
        a: { top: 120 },
        b: { top: 420 },
      },
    };

    assert.equal(areTimelineMeasurementsEqual(current, next), true);
    assert.equal(keepPreviousTimelineMeasurementIfEqual(current, next), current);
  });

  it("detects changed container height", () => {
    const next = { ...current, containerHeight: 801 };

    assert.equal(areTimelineMeasurementsEqual(current, next), false);
    assert.equal(keepPreviousTimelineMeasurementIfEqual(current, next), next);
  });

  it("detects changed node positions", () => {
    const next = {
      containerHeight: 800,
      positions: {
        a: { top: 121 },
        b: { top: 420 },
      },
    };

    assert.equal(areTimelineMeasurementsEqual(current, next), false);
  });

  it("detects added or removed node positions", () => {
    assert.equal(
      areTimelineMeasurementsEqual(current, {
        containerHeight: 800,
        positions: {
          a: { top: 120 },
        },
      }),
      false,
    );
  });
});
