"use client";

import { useState } from "react";
import type { TimelineNode } from "@/types";
import type { PhaseGroup } from "@/utils/timeline";

interface Props {
  nodes: TimelineNode[];
  phaseGroups: PhaseGroup[];
  activeNodeId: string | null;
  visibleNodeIds: Set<string>;
  onNavigateToNode: (id: string) => void;
}

export function MiniMap({
  nodes,
  phaseGroups,
  activeNodeId,
  visibleNodeIds,
  onNavigateToNode,
}: Props) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const phaseStartSet = new Set(phaseGroups.map((g) => g.startIndex));
  const activeIndex = activeNodeId
    ? nodes.findIndex((n) => n.id === activeNodeId)
    : -1;

  const visibleCount = nodes.filter((n) => visibleNodeIds.has(n.id)).length;
  const viewportRatio = Math.max(0.08, Math.min(0.3, visibleCount > 0 ? 5 / visibleCount : 0.15));
  const indicatorHeight = `${viewportRatio * 100}%`;
  const indicatorTop = activeIndex >= 0
    ? `${(activeIndex / nodes.length) * (1 - viewportRatio) * 100}%`
    : "0%";

  return (
    <div
      className="fixed right-4 top-1/2 z-30 hidden -translate-y-1/2 lg:flex"
      data-export-hide
    >
      <div className="minimap-scroll relative flex w-12 flex-col items-center gap-0.5 rounded-lg border border-chrono-border bg-chrono-bg/90 px-1.5 py-2 backdrop-blur-sm"
        style={{ maxHeight: "60vh", overflowY: "auto" }}
      >
        {/* Viewport indicator */}
        {activeIndex >= 0 && (
          <div
            className="pointer-events-none absolute left-0 right-0 rounded-lg bg-chrono-accent/10"
            style={{ top: indicatorTop, height: indicatorHeight }}
          />
        )}

        {nodes.map((node, i) => {
          const isActive = node.id === activeNodeId;
          const isFiltered = !visibleNodeIds.has(node.id);
          const showDivider = phaseStartSet.has(i) && i > 0;

          const sig = node.significance;
          let dotSize = "h-1.5 w-1.5";
          let dotColor = "bg-chrono-medium";
          if (sig === "revolutionary") {
            dotSize = "h-2.5 w-2.5";
            dotColor = "bg-chrono-revolutionary";
          } else if (sig === "high") {
            dotSize = "h-2 w-2";
            dotColor = "bg-chrono-high";
          }

          return (
            <div key={node.id} className="relative flex flex-col items-center">
              {showDivider && (
                <div className="my-0.5 h-px w-6 bg-chrono-border" />
              )}
              <button
                className={`relative rounded-full transition-all ${dotSize} ${dotColor} ${
                  isActive ? "scale-125 ring-2 ring-chrono-accent/40" : ""
                } ${isFiltered ? "opacity-20" : "opacity-100"}`}
                onClick={() => onNavigateToNode(node.id)}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
              />
              {hoveredIndex === i && (
                <div className="pointer-events-none absolute right-full mr-2 top-1/2 -translate-y-1/2 whitespace-nowrap rounded bg-chrono-surface px-2 py-1 text-chrono-tiny text-chrono-text shadow-lg border border-chrono-border">
                  {node.date} — {node.title}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
