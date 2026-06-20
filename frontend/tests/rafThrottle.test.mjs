import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createRafThrottle } from "../src/utils/rafThrottle.ts";

function createFakeRaf() {
  let nextId = 1;
  const callbacks = new Map();

  return {
    requestAnimationFrame(callback) {
      const id = nextId;
      nextId += 1;
      callbacks.set(id, callback);
      return id;
    },
    cancelAnimationFrame(id) {
      callbacks.delete(id);
    },
    runNextFrame() {
      const scheduled = [...callbacks.entries()];
      callbacks.clear();
      for (const [, callback] of scheduled) {
        callback(16);
      }
    },
    get pendingCount() {
      return callbacks.size;
    },
  };
}

describe("createRafThrottle", () => {
  it("coalesces repeated calls into one callback per animation frame", () => {
    const raf = createFakeRaf();
    let calls = 0;
    const throttled = createRafThrottle(() => {
      calls += 1;
    }, raf);

    throttled();
    throttled();
    throttled();

    assert.equal(calls, 0);
    assert.equal(raf.pendingCount, 1);

    raf.runNextFrame();

    assert.equal(calls, 1);
    assert.equal(raf.pendingCount, 0);
  });

  it("schedules a later frame after the pending callback has run", () => {
    const raf = createFakeRaf();
    let calls = 0;
    const throttled = createRafThrottle(() => {
      calls += 1;
    }, raf);

    throttled();
    raf.runNextFrame();
    throttled();
    raf.runNextFrame();

    assert.equal(calls, 2);
  });

  it("cancels a pending callback during cleanup", () => {
    const raf = createFakeRaf();
    let calls = 0;
    const throttled = createRafThrottle(() => {
      calls += 1;
    }, raf);

    throttled();
    throttled.cancel();
    raf.runNextFrame();

    assert.equal(calls, 0);
    assert.equal(raf.pendingCount, 0);
  });
});
