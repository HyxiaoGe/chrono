import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { chooseActiveNodeId } from "../src/utils/activeNode.ts";

function rect(top, height) {
  return {
    top,
    bottom: top + height,
    height,
  };
}

describe("chooseActiveNodeId", () => {
  it("returns the last node near the bottom of the page", () => {
    const activeId = chooseActiveNodeId({
      nodeIds: ["a", "b", "c"],
      getRect: () => rect(0, 100),
      viewportHeight: 800,
      scrollY: 1250,
      documentHeight: 2000,
    });

    assert.equal(activeId, "c");
  });

  it("chooses the visible node closest to viewport center", () => {
    const activeId = chooseActiveNodeId({
      nodeIds: ["top", "middle", "bottom"],
      getRect: (id) => {
        if (id === "top") return rect(20, 100);
        if (id === "middle") return rect(350, 120);
        return rect(720, 100);
      },
      viewportHeight: 800,
      scrollY: 200,
      documentHeight: 2400,
    });

    assert.equal(activeId, "middle");
  });

  it("ignores nodes far outside the viewport buffer", () => {
    const activeId = chooseActiveNodeId({
      nodeIds: ["above", "visible", "below"],
      getRect: (id) => {
        if (id === "above") return rect(-450, 100);
        if (id === "visible") return rect(300, 100);
        return rect(1100, 100);
      },
      viewportHeight: 800,
      scrollY: 200,
      documentHeight: 2400,
    });

    assert.equal(activeId, "visible");
  });
});
