import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  RESEARCH_MAINTENANCE_ENABLED,
  shouldBlockResearchCreation,
} from "../src/utils/researchMaintenance.ts";

describe("research maintenance mode", () => {
  it("blocks direct new-session research creation while maintenance is enabled", () => {
    assert.equal(RESEARCH_MAINTENANCE_ENABLED, true);
    assert.equal(shouldBlockResearchCreation("new"), true);
    assert.equal(shouldBlockResearchCreation("existing-session-id"), false);
  });
});
