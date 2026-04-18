"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import type { SynthesisData } from "@/types";

interface SynthesisBannerProps {
  synthesisData: SynthesisData;
  nodeCount: number;
  timelineSpan: string;
}

export default function SynthesisBanner({
  synthesisData,
  nodeCount,
  timelineSpan,
}: SynthesisBannerProps) {
  const [expanded, setExpanded] = useState(true);

  const headline =
    synthesisData.summary.split(". ")[0] || synthesisData.key_insight;

  const connectionCount = synthesisData.connections?.length ?? 0;

  return (
    <div className="mb-6 rounded-xl border border-chrono-border/50 bg-chrono-surface/50 backdrop-blur-sm overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-chrono-surface/70 transition-colors"
      >
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-chrono-accent/15 text-chrono-accent">
          <Icon name="sparkles" size={12} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-chrono-tiny uppercase tracking-[0.12em] text-chrono-accent/80 font-medium">
            <span>Synthesis</span>
            <span className="text-chrono-text-muted/60 normal-case tracking-normal">deepseek</span>
          </div>
          <p className="mt-1 text-chrono-caption text-chrono-text font-medium">{headline}</p>
        </div>
        <Icon
          name={expanded ? "chevronUp" : "chevron"}
          size={14}
          className="text-chrono-text-muted"
        />
      </button>
      {expanded && (
        <div className="px-5 pb-4 border-t border-chrono-border/30">
          <p className="mt-4 text-chrono-body text-chrono-text-secondary leading-relaxed">
            {synthesisData.summary}
          </p>
          <div className="mt-4 rounded-lg border-l-2 border-chrono-accent/60 bg-chrono-accent/[0.04] px-4 py-2.5">
            <div className="text-chrono-tiny uppercase tracking-wider text-chrono-accent/70 font-medium mb-1">
              Key insight
            </div>
            <p className="text-chrono-caption text-chrono-text leading-relaxed italic">
              {synthesisData.key_insight}
            </p>
          </div>
          <div className="mt-4 flex flex-wrap gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-chrono-bg/60 border border-chrono-border/40 px-2.5 py-0.5 text-chrono-tiny text-chrono-text-muted">
              <span className="text-chrono-text font-mono tabular-nums">{nodeCount}</span> nodes
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-chrono-bg/60 border border-chrono-border/40 px-2.5 py-0.5 text-chrono-tiny text-chrono-text-muted">
              <span className="text-chrono-text font-mono tabular-nums">
                {synthesisData.source_count}
              </span>{" "}
              sources
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-chrono-bg/60 border border-chrono-border/40 px-2.5 py-0.5 text-chrono-tiny text-chrono-text-muted">
              <span className="text-chrono-text font-mono tabular-nums">{connectionCount}</span>{" "}
              connections
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-chrono-bg/60 border border-chrono-border/40 px-2.5 py-0.5 text-chrono-tiny text-chrono-text-muted">
              <span className="text-chrono-text font-mono tabular-nums">{timelineSpan}</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
