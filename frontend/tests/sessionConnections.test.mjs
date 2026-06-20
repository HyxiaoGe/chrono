import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getSessionConnections } from "../src/utils/sessionConnections.ts";

describe("getSessionConnections", () => {
  it("returns a shared empty array when synthesis has no connections", () => {
    const first = getSessionConnections(null);
    const second = getSessionConnections({ connections: undefined });

    assert.equal(first, second);
    assert.deepEqual(first, []);
  });

  it("returns synthesis connections without copying them", () => {
    const connections = [
      {
        from_id: "a",
        to_id: "b",
        type: "enabled",
        relationship: "enabled",
        strength: 0.8,
      },
    ];

    assert.equal(getSessionConnections({ connections }), connections);
  });
});
