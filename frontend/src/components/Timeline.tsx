"use client";

import type { TimelineNode, SynthesisData, CompleteData } from "@/types";
import { TimelineNodeCard } from "./TimelineNode";

interface Props {
  nodes: TimelineNode[];
  progressMessage: string;
  synthesisData: SynthesisData | null;
  completeData: CompleteData | null;
  language: string;
}

export function Timeline({
  nodes,
  progressMessage,
  synthesisData,
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

      {synthesisData && (
        <div className="mb-10 rounded-lg border border-zinc-800 bg-zinc-900/50 p-6 animate-fade-in">
          <h3 className="mb-3 text-sm font-medium text-zinc-400">
            {isZh ? "调研总结" : "Research Summary"}
          </h3>
          <p className="mb-4 leading-relaxed text-zinc-300">
            {synthesisData.summary}
          </p>
          <p className="text-sm italic text-zinc-400">
            {synthesisData.key_insight}
          </p>
          <div className="mt-4 flex gap-4 text-xs text-zinc-600">
            <span>{synthesisData.timeline_span}</span>
            <span>&middot;</span>
            <span>
              {isZh
                ? `${synthesisData.source_count} 个来源`
                : `${synthesisData.source_count} sources`}
            </span>
          </div>
          {synthesisData.verification_notes.length > 0 && (
            <div className="mt-3 text-xs text-amber-500/70">
              {synthesisData.verification_notes.map((note, i) => (
                <p key={i}>{note}</p>
              ))}
            </div>
          )}
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
