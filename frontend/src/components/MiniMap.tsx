"use client";

import type { TimelineNode } from "@/types";

interface Props {
  nodes: TimelineNode[];
  activeNodeId: string | null;
  onNavigateToNode: (id: string) => void;
}

export function MiniMap({
  nodes,
  activeNodeId,
  onNavigateToNode,
}: Props) {
  const activeNode = activeNodeId
    ? nodes.find((n) => n.id === activeNodeId)
    : null;
  const activeYear = activeNode
    ? activeNode.date.slice(0, 4)
    : null;

  const firstYear = nodes.length > 0 ? nodes[0].date.slice(0, 4) : null;
  const lastYear = nodes.length > 0 ? nodes[nodes.length - 1].date.slice(0, 4) : null;
  const span = firstYear && lastYear && firstYear !== lastYear
    ? `${firstYear} – ${lastYear}`
    : firstYear;

  return (
    <div
      className="fixed right-4 bottom-4 z-30 hidden items-center gap-2 rounded-lg border border-chrono-border bg-chrono-surface/95 px-3 py-2 backdrop-blur-sm lg:flex"
      data-export-hide
    >
      {activeYear && (
        <span className="text-chrono-caption font-medium text-chrono-text">
          {activeYear}
        </span>
      )}
      {activeYear && span && (
        <span className="text-chrono-tiny text-chrono-text-muted">/</span>
      )}
      {span && (
        <span className="text-chrono-tiny text-chrono-text-muted">
          {span}
        </span>
      )}
      <button
        onClick={() => onNavigateToNode(nodes[0].id)}
        className="ml-1 flex h-6 w-6 items-center justify-center rounded text-chrono-text-muted transition-colors hover:bg-chrono-surface-hover hover:text-chrono-text-secondary"
        title="Back to top"
      >
        ↑
      </button>
    </div>
  );
}
