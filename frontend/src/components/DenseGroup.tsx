"use client";

import { useState } from "react";
import type { TimelineNode } from "@/types";
import type { DenseGroup } from "@/utils/timeline";
import type { ConnectionMap } from "@/hooks/useConnections";
import { TimelineNodeCard } from "./TimelineNode";

interface Props {
  group: DenseGroup;
  nodes: TimelineNode[];
  selectedNodeId: string | null;
  highlightedNodeId: string | null;
  onSelectNode: (id: string) => void;
  connectionMap: ConnectionMap;
  language: string;
}

function dotClass(): string {
  return "h-2 w-2 rounded-full bg-chrono-medium";
}

export function DenseGroupBlock({
  group,
  nodes,
  selectedNodeId,
  highlightedNodeId,
  onSelectNode,
  connectionMap,
  language,
}: Props) {
  const isZh = language.startsWith("zh");
  const groupNodes = nodes.slice(group.startIndex, group.endIndex + 1);
  const count = groupNodes.length;

  const needsAutoExpand = !!(
    (selectedNodeId && group.nodeIds.includes(selectedNodeId)) ||
    (highlightedNodeId && group.nodeIds.includes(highlightedNodeId))
  );

  const [manualExpanded, setManualExpanded] = useState(false);
  const [prevNeedsAutoExpand, setPrevNeedsAutoExpand] = useState(false);

  if (needsAutoExpand && !prevNeedsAutoExpand) {
    setManualExpanded(true);
  }
  if (needsAutoExpand !== prevNeedsAutoExpand) {
    setPrevNeedsAutoExpand(needsAutoExpand);
  }

  const expanded = manualExpanded;

  if (!expanded) {
    const firstYear = groupNodes[0].date.slice(0, 4);
    const lastYear = groupNodes[groupNodes.length - 1].date.slice(0, 4);
    const dateRange = firstYear === lastYear ? firstYear : `${firstYear} — ${lastYear}`;
    const previewNodes = groupNodes.slice(0, 4);

    return (
      <div
        id={groupNodes[0].id}
        className="mb-6 flex cursor-pointer items-start transition-colors hover:bg-chrono-surface/50"
        onClick={() => setManualExpanded(true)}
      >
        <div className="w-16 shrink-0 pt-2 text-right text-chrono-tiny text-chrono-text-muted">
          {dateRange}
        </div>
        <div className="flex w-8 shrink-0 justify-center pt-2">
          <div className={dotClass()} />
        </div>
        <div className="min-w-0 flex-1 px-4 py-2">
          <span className="text-chrono-caption text-chrono-text-muted">
            {count} {isZh ? "个事件" : "events"}
          </span>
          <p className="mt-0.5 truncate text-chrono-tiny text-chrono-text-muted">
            {previewNodes.map((n, i) => (
              <span key={n.id}>
                {i > 0 && " · "}
                {n.significance === "high" ? <strong>{n.title}</strong> : n.title}
              </span>
            ))}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {groupNodes.map((node) => {
        const connInfo = connectionMap.get(node.id);
        const connCount = connInfo
          ? connInfo.outgoing.length + connInfo.incoming.length
          : 0;
        return (
          <div key={node.id} id={node.id} className="mb-6 flex items-start">
            <div className="w-16 shrink-0 pt-2 text-right text-chrono-tiny text-chrono-text-muted">
              {node.date}
            </div>
            <div className="flex w-8 shrink-0 justify-center pt-2">
              <div className={dotClass()} />
            </div>
            <div className="min-w-0 flex-1">
              <TimelineNodeCard
                node={node}
                isSelected={selectedNodeId === node.id}
                isHighlighted={highlightedNodeId === node.id}
                connectionCount={connCount}
                onSelect={onSelectNode}
                language={language}
              />
            </div>
          </div>
        );
      })}
      <div className="mb-6 flex items-start">
        <div className="w-16 shrink-0" />
        <div className="w-8 shrink-0" />
        <div className="min-w-0 flex-1">
          <button
            onClick={() => setManualExpanded(false)}
            className="px-4 text-chrono-tiny text-chrono-text-muted transition-colors hover:text-chrono-text-secondary"
          >
            ▴ {isZh ? "收起" : "Collapse"}
          </button>
        </div>
      </div>
    </div>
  );
}
