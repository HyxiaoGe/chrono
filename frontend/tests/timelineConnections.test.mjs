import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildTimelineConnectionIndex } from "../src/utils/timelineConnections.ts";

const connections = [
  { from_id: "a", to_id: "b", relationship: "enabled", type: "enabled" },
  { from_id: "c", to_id: "a", relationship: "responded", type: "responded_to" },
  { from_id: "b", to_id: "d", relationship: "caused", type: "caused" },
];

describe("buildTimelineConnectionIndex", () => {
  it("indexes related ids and active connections by endpoint", () => {
    const index = buildTimelineConnectionIndex(connections);
    const a = index.get("a");

    assert.deepEqual([...a.relatedIds].sort(), ["b", "c"]);
    assert.deepEqual(
      a.connections.map((item) => ({
        index: item.index,
        from_id: item.connection.from_id,
        to_id: item.connection.to_id,
      })),
      [
        { index: 0, from_id: "a", to_id: "b" },
        { index: 1, from_id: "c", to_id: "a" },
      ],
    );
  });

  it("keeps original connection indexes for filtered rendering", () => {
    const index = buildTimelineConnectionIndex(connections);

    assert.deepEqual(
      index.get("b").connections.map((item) => item.index),
      [0, 2],
    );
  });
});
