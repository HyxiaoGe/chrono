import type { TimelineNode } from "@/types";

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

export interface DenseGroup {
  startIndex: number;
  endIndex: number;
  nodeIds: string[];
}

export function computeDenseGroups(nodes: TimelineNode[]): DenseGroup[] {
  const groups: DenseGroup[] = [];
  let runStart = -1;

  function flushRun(end: number) {
    if (runStart >= 0 && end - runStart >= 3) {
      groups.push({
        startIndex: runStart,
        endIndex: end,
        nodeIds: nodes.slice(runStart, end + 1).map((n) => n.id),
      });
    }
    runStart = -1;
  }

  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (n.significance === "revolutionary") {
      flushRun(i - 1);
      continue;
    }
    // Phase boundary breaks the run
    if (
      runStart >= 0 &&
      n.phase_name &&
      nodes[i - 1].phase_name &&
      n.phase_name !== nodes[i - 1].phase_name
    ) {
      flushRun(i - 1);
    }
    if (runStart < 0) runStart = i;
  }
  flushRun(nodes.length - 1);

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
