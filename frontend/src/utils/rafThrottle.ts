interface RafScheduler {
  requestAnimationFrame(callback: FrameRequestCallback): number;
  cancelAnimationFrame(handle: number): void;
}

export type RafThrottledCallback = (() => void) & {
  cancel: () => void;
};

export function createRafThrottle(
  callback: () => void,
  scheduler: RafScheduler = globalThis,
): RafThrottledCallback {
  let frameId: number | null = null;

  const throttled = (() => {
    if (frameId !== null) return;
    frameId = scheduler.requestAnimationFrame(() => {
      frameId = null;
      callback();
    });
  }) as RafThrottledCallback;

  throttled.cancel = () => {
    if (frameId === null) return;
    scheduler.cancelAnimationFrame(frameId);
    frameId = null;
  };

  return throttled;
}
