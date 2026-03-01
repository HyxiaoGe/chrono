import type { TimelineNode, FilterState } from "@/types";

export interface PhaseGroup {
  name: string;
  startIndex: number;
  endIndex: number;
  timeRange: string;
}

function buildGroup(
  name: string,
  start: number,
  end: number,
  nodes: TimelineNode[],
): PhaseGroup {
  const startYear = nodes[start].date.slice(0, 4);
  const endYear = nodes[end].date.slice(0, 4);
  const timeRange = startYear === endYear ? startYear : `${startYear} - ${endYear}`;
  return { name, startIndex: start, endIndex: end, timeRange };
}

export function computePhaseGroups(nodes: TimelineNode[]): PhaseGroup[] {
  if (nodes.length === 0) return [];
  if (!nodes.some((n) => n.phase_name)) return [];

  const groups: PhaseGroup[] = [];
  let currentPhase: string | null = null;
  let startIndex = 0;

  for (let i = 0; i < nodes.length; i++) {
    const phase: string | null = nodes[i].phase_name ?? currentPhase;
    if (phase && phase !== currentPhase) {
      if (currentPhase !== null) {
        groups.push(buildGroup(currentPhase, startIndex, i - 1, nodes));
      }
      currentPhase = phase;
      startIndex = i;
    }
  }
  if (currentPhase !== null) {
    groups.push(buildGroup(currentPhase, startIndex, nodes.length - 1, nodes));
  }

  return groups;
}

export function computeYearBounds(nodes: TimelineNode[]): [number, number] | null {
  if (nodes.length === 0) return null;
  let min = Infinity;
  let max = -Infinity;
  for (const n of nodes) {
    const y = parseInt(n.date.slice(0, 4), 10);
    if (!isNaN(y)) {
      if (y < min) min = y;
      if (y > max) max = y;
    }
  }
  if (min === Infinity) return null;
  if (max - min < 2) return null;
  return [min, max];
}

export function isNodeFiltered(node: TimelineNode, filter: FilterState): boolean {
  if (!filter.significance.has(node.significance)) return false;

  if (filter.phase !== null && node.phase_name && node.phase_name !== filter.phase) {
    return false;
  }

  if (filter.yearRange) {
    const y = parseInt(node.date.slice(0, 4), 10);
    if (!isNaN(y) && (y < filter.yearRange[0] || y > filter.yearRange[1])) {
      return false;
    }
  }

  return true;
}

export function isNodeSearchMatch(node: TimelineNode, query: string): boolean {
  if (!query) return false;
  const q = query.toLowerCase();
  return (
    node.title.toLowerCase().includes(q) ||
    node.description.toLowerCase().includes(q) ||
    (node.subtitle?.toLowerCase().includes(q) ?? false)
  );
}
