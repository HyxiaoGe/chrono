export function formatElapsedSeconds(value: number): string {
  const elapsed = Math.max(0, Math.floor(value));
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function elapsedSecondsSince(startedAtMs: number, nowMs = Date.now()): number {
  return Math.max(0, Math.floor((nowMs - startedAtMs) / 1000));
}
