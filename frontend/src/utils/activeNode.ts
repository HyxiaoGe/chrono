export interface NodeRect {
  top: number;
  bottom: number;
  height: number;
}

interface ChooseActiveNodeOptions {
  nodeIds: string[];
  getRect: (id: string) => NodeRect | null;
  viewportHeight: number;
  scrollY: number;
  documentHeight: number;
}

export function chooseActiveNodeId({
  nodeIds,
  getRect,
  viewportHeight,
  scrollY,
  documentHeight,
}: ChooseActiveNodeOptions): string | null {
  if (nodeIds.length === 0) return null;

  const atBottom = viewportHeight + scrollY >= documentHeight - 50;
  if (atBottom) {
    return nodeIds[nodeIds.length - 1];
  }

  const viewportCenter = viewportHeight / 2;
  let closest: string | null = null;
  let minDistance = Infinity;

  for (const id of nodeIds) {
    const rect = getRect(id);
    if (!rect) continue;
    if (rect.bottom < -200 || rect.top > viewportHeight + 200) continue;

    const elementCenter = rect.top + rect.height / 2;
    const distance = Math.abs(elementCenter - viewportCenter);
    if (distance < minDistance) {
      minDistance = distance;
      closest = id;
    }
  }

  return closest;
}
