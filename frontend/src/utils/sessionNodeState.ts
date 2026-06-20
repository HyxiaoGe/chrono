import type { TimelineNode } from "@/types";

export interface SessionNodeState {
  nodeIds: string[];
  completedNodeCount: number;
  activeNode: TimelineNode | null;
  selectedNode: TimelineNode | null;
  activeYear: string | null;
  activePhase: string | null;
}

export function deriveSessionNodeState(
  nodes: TimelineNode[],
  ids: {
    activeNodeId: string | null;
    selectedNodeId: string | null;
  },
): SessionNodeState {
  const nodeIds: string[] = [];
  let completedNodeCount = 0;
  let activeNode: TimelineNode | null = null;
  let selectedNode: TimelineNode | null = null;

  for (const node of nodes) {
    nodeIds.push(node.id);
    if (node.status === "complete") {
      completedNodeCount += 1;
    }
    if (node.id === ids.activeNodeId) {
      activeNode = node;
    }
    if (node.id === ids.selectedNodeId) {
      selectedNode = node;
    }
  }

  return {
    nodeIds,
    completedNodeCount,
    activeNode,
    selectedNode,
    activeYear: activeNode ? activeNode.date.slice(0, 4) : null,
    activePhase: activeNode?.phase_name ?? null,
  };
}
