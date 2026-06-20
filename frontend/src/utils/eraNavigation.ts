import type { TimelineNode } from "@/types";

export interface EraInfo {
  key: string;
  label: string;
  caption: string;
  years: number[];
  nodes: TimelineNode[];
  firstNodeId: string | undefined;
  weight: number;
  revolutionaryCount: number;
}

export interface EraMarkerPosition {
  key: string;
  left: number;
}

export interface EraNavigationState {
  eras: EraInfo[];
  totalWeight: number;
  markerPositions: EraMarkerPosition[];
  eraKeyByNodeId: Map<string, string>;
}

function toEraKey(label: string): string {
  return label.toLowerCase().replace(/\s+/g, "-");
}

function buildEra(label: string, nodes: TimelineNode[], key = toEraKey(label)): EraInfo {
  const years = [
    ...new Set(nodes.map((node) => parseInt(node.date.slice(0, 4), 10))),
  ].sort();

  return {
    key,
    label,
    caption: `${years[0]}${years.length > 1 ? `–${years[years.length - 1]}` : ""}`,
    years,
    nodes,
    firstNodeId: nodes[0]?.id,
    weight: Math.max(1, nodes.length),
    revolutionaryCount: nodes.reduce(
      (count, node) => count + (node.significance === "revolutionary" ? 1 : 0),
      0,
    ),
  };
}

function buildEras(nodes: TimelineNode[]): EraInfo[] {
  if (nodes.length === 0) return [];

  const hasPhases = nodes.some((node) => node.phase_name);
  if (hasPhases) {
    const phaseMap = new Map<string, TimelineNode[]>();
    for (const node of nodes) {
      const key = node.phase_name || "Other";
      const existing = phaseMap.get(key);
      if (existing) {
        existing.push(node);
      } else {
        phaseMap.set(key, [node]);
      }
    }
    return Array.from(phaseMap.entries()).map(([label, eraNodes]) =>
      buildEra(label, eraNodes),
    );
  }

  const yearMap = new Map<number, TimelineNode[]>();
  for (const node of nodes) {
    const year = parseInt(node.date.slice(0, 4), 10);
    const existing = yearMap.get(year);
    if (existing) {
      existing.push(node);
    } else {
      yearMap.set(year, [node]);
    }
  }

  return Array.from(yearMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([year, eraNodes]) => ({
      ...buildEra(String(year), eraNodes, `y${year}`),
      caption: `${eraNodes.length} events`,
      years: [year],
    }));
}

export function buildEraNavigationState(
  nodes: TimelineNode[],
): EraNavigationState {
  const eras = buildEras(nodes);
  const totalWeight = eras.reduce((sum, era) => sum + era.weight, 0) || 1;
  const markerPositions = eras.slice(1).map((era, index) => {
    const accumulatedWeight = eras
      .slice(0, index + 1)
      .reduce((sum, item) => sum + item.weight, 0);
    return {
      key: era.key,
      left: (accumulatedWeight / totalWeight) * 100,
    };
  });
  const eraKeyByNodeId = new Map<string, string>();
  for (const era of eras) {
    for (const node of era.nodes) {
      eraKeyByNodeId.set(node.id, era.key);
    }
  }

  return {
    eras,
    totalWeight,
    markerPositions,
    eraKeyByNodeId,
  };
}

export function selectCurrentEraKey(
  state: EraNavigationState,
  params: { activeNodeId: string | null; progress: number },
): string | undefined {
  if (params.activeNodeId) {
    const activeEraKey = state.eraKeyByNodeId.get(params.activeNodeId);
    if (activeEraKey) return activeEraKey;
  }

  let accumulated = 0;
  for (const era of state.eras) {
    const eraProgressWidth = era.weight / state.totalWeight;
    if (params.progress <= accumulated + eraProgressWidth + 0.001) {
      return era.key;
    }
    accumulated += eraProgressWidth;
  }
  return state.eras[state.eras.length - 1]?.key;
}
