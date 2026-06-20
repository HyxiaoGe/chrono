import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildEraNavigationState,
  selectCurrentEraKey,
} from "../src/utils/eraNavigation.ts";

const nodes = [
  {
    id: "launch-1",
    date: "2007-01-09",
    title: "iPhone announced",
    significance: "revolutionary",
    phase_name: "Launch",
  },
  {
    id: "platform-1",
    date: "2007-06-29",
    title: "iPhone ships",
    significance: "high",
    phase_name: "Platform",
  },
  {
    id: "platform-2",
    date: "2008-07-10",
    title: "App Store launches",
    significance: "revolutionary",
    phase_name: "Platform",
  },
];

describe("buildEraNavigationState", () => {
  it("precomputes era metadata and marker positions", () => {
    const state = buildEraNavigationState(nodes);

    assert.deepEqual(
      state.eras.map((era) => ({
        key: era.key,
        label: era.label,
        revolutionaryCount: era.revolutionaryCount,
        weight: era.weight,
      })),
      [
        { key: "launch", label: "Launch", revolutionaryCount: 1, weight: 1 },
        { key: "platform", label: "Platform", revolutionaryCount: 1, weight: 2 },
      ],
    );
    assert.equal(state.totalWeight, 3);
    assert.equal(state.markerPositions[0]?.key, "platform");
    assert.ok(Math.abs(state.markerPositions[0].left - 100 / 3) < 0.000001);
  });

  it("indexes active eras by exact node id instead of shared years", () => {
    const state = buildEraNavigationState(nodes);

    assert.equal(selectCurrentEraKey(state, { activeNodeId: "platform-1", progress: 0 }), "platform");
  });

  it("falls back to scroll progress when no active node is available", () => {
    const state = buildEraNavigationState(nodes);

    assert.equal(selectCurrentEraKey(state, { activeNodeId: null, progress: 0 }), "launch");
    assert.equal(selectCurrentEraKey(state, { activeNodeId: null, progress: 0.9 }), "platform");
  });
});
