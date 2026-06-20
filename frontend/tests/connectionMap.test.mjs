import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getConnectionMap } from "../src/hooks/useConnections.ts";

const nodes = [
  { id: "a", title: "Alpha" },
  { id: "b", title: "Beta" },
  { id: "c", title: "Gamma" },
];

describe("getConnectionMap", () => {
  it("returns a shared empty map when there are no connections", () => {
    const first = getConnectionMap(undefined, nodes);
    const second = getConnectionMap([], nodes);

    assert.equal(first, second);
    assert.equal(first.size, 0);
  });

  it("builds incoming and outgoing connection info", () => {
    const map = getConnectionMap(
      [
        { from_id: "a", to_id: "b", relationship: "enabled", type: "enabled" },
        { from_id: "c", to_id: "a", relationship: "caused", type: "caused" },
      ],
      nodes,
    );

    assert.deepEqual(map.get("a"), {
      outgoing: [
        {
          targetId: "b",
          targetTitle: "Beta",
          relationship: "enabled",
          type: "enabled",
        },
      ],
      incoming: [
        {
          sourceId: "c",
          sourceTitle: "Gamma",
          relationship: "caused",
          type: "caused",
        },
      ],
    });
  });
});
