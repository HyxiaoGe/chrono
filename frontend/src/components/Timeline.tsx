"use client";

import type { TimelineNode, CompleteData } from "@/types";
import { TimelineNodeCard } from "./TimelineNode";

interface Props {
  nodes: TimelineNode[];
  progressMessage: string;
  completeData: CompleteData | null;
  language: string;
}

export function Timeline({
  nodes,
  progressMessage,
  completeData,
  language,
}: Props) {
  const isZh = language.startsWith("zh");

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      {/* Progress / status bar */}
      {!completeData && progressMessage && (
        <div className="mb-8 text-center text-sm text-zinc-500">
          <span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-zinc-400" />
          {progressMessage}
        </div>
      )}

      {completeData && (
        <div className="mb-8 text-center text-sm text-zinc-600">
          {isZh
            ? `调研完成 · ${completeData.total_nodes} 个节点 · ${completeData.detail_completed} 个已补充详情`
            : `Research complete · ${completeData.total_nodes} nodes · ${completeData.detail_completed} enriched`}
        </div>
      )}

      {/* Timeline */}
      <div className="relative">
        {/* Center line */}
        <div className="absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2 bg-zinc-800" />

        {nodes.map((node, index) => (
          <TimelineNodeCard
            key={node.id}
            node={node}
            side={index % 2 === 0 ? "left" : "right"}
            language={language}
          />
        ))}
      </div>
    </div>
  );
}
