import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { deriveHistorySections } from "../src/utils/historySections.ts";

function item(id, topicType = "product") {
  return {
    id,
    topic: id,
    topic_type: topicType,
    language: "en",
    complexity_level: "medium",
    total_nodes: 10,
    source_count: 1,
    created_at: "2026-06-19T00:00:00Z",
    timeline_span: "2020 - 2026",
    key_insight: "",
  };
}

describe("deriveHistorySections", () => {
  it("groups larger history lists in one derived shape", () => {
    const result = deriveHistorySections([
      item("iphone", "product"),
      item("ai", "technology"),
      item("ww2", "historical_event"),
      item("jazz", "culture"),
      item("ipad", "product"),
      item("web", "technology"),
      item("rome", "historical_event"),
    ]);

    assert.equal(result.mode, "grouped");
    assert.deepEqual(
      result.tech.map((entry) => entry.id),
      ["iphone", "ai", "ipad", "web"],
    );
    assert.deepEqual(
      result.history.map((entry) => entry.id),
      ["ww2", "jazz", "rome"],
    );
  });

  it("limits compact history until expanded", () => {
    const items = [item("1"), item("2"), item("3"), item("4"), item("5"), item("6")];

    const compact = deriveHistorySections(items, { expanded: false });
    assert.equal(compact.mode, "compact");
    assert.equal(compact.hasMore, true);
    assert.deepEqual(
      compact.items.map((entry) => entry.id),
      ["1", "2", "3", "4", "5"],
    );

    const expanded = deriveHistorySections(items, { expanded: true });
    assert.equal(expanded.mode, "compact");
    assert.equal(expanded.hasMore, true);
    assert.deepEqual(
      expanded.items.map((entry) => entry.id),
      ["1", "2", "3", "4", "5", "6"],
    );
  });
});
