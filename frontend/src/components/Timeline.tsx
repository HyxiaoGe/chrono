"use client";

import type {
  TimelineNode,
  SynthesisData,
  CompleteData,
  ResearchProposal,
} from "@/types";
import { TimelineNodeCard } from "./TimelineNode";

interface Props {
  nodes: TimelineNode[];
  progressMessage: string;
  synthesisData: SynthesisData | null;
  completeData: CompleteData | null;
  proposal: ResearchProposal | null;
  language: string;
  selectedNodeId: string | null;
  onSelectNode: (id: string) => void;
}

interface Separator {
  label: string;
  insertBeforeIndex: number;
}

function computeSeparators(nodes: TimelineNode[]): Separator[] {
  if (nodes.length === 0) return [];

  const years = nodes.map((n) => {
    const y = parseInt(n.date.slice(0, 4), 10);
    return isNaN(y) ? 0 : y;
  });

  const changePoints: { index: number; year: number; prevYear: number }[] = [];
  for (let i = 1; i < years.length; i++) {
    if (years[i] !== years[i - 1] && years[i] !== 0 && years[i - 1] !== 0) {
      changePoints.push({ index: i, year: years[i], prevYear: years[i - 1] });
    }
  }

  if (changePoints.length === 0) return [];

  const separators: Separator[] = [];
  let i = 0;

  while (i < changePoints.length) {
    const start = changePoints[i];
    let j = i;

    while (
      j + 1 < changePoints.length &&
      changePoints[j + 1].year - changePoints[j].year <= 2 &&
      changePoints[j + 1].index - changePoints[j].index <= 2
    ) {
      j++;
    }

    if (j - i >= 2) {
      const startDecade = Math.floor(start.prevYear / 10) * 10;
      const endDecade = Math.floor(changePoints[j].year / 10) * 10;
      if (startDecade === endDecade) {
        separators.push({
          label: `${startDecade}s`,
          insertBeforeIndex: start.index,
        });
      } else {
        separators.push({
          label: `${start.prevYear}`,
          insertBeforeIndex: start.index,
        });
        for (let k = i + 1; k <= j; k++) {
          const decade = Math.floor(changePoints[k].year / 10) * 10;
          const prevDecade = Math.floor(changePoints[k].prevYear / 10) * 10;
          if (decade !== prevDecade) {
            separators.push({
              label: `${changePoints[k].year}`,
              insertBeforeIndex: changePoints[k].index,
            });
          }
        }
      }
    } else {
      for (let k = i; k <= j; k++) {
        separators.push({
          label: `${changePoints[k].year}`,
          insertBeforeIndex: changePoints[k].index,
        });
      }
    }

    i = j + 1;
  }

  return separators;
}

function dotClass(sig: string): string {
  if (sig === "revolutionary") {
    return "h-4 w-4 rounded-full bg-chrono-revolutionary ring-4 ring-chrono-revolutionary/20";
  }
  if (sig === "high") {
    return "h-3 w-3 rounded-full bg-chrono-high";
  }
  return "h-2 w-2 rounded-full bg-chrono-medium";
}

export function Timeline({
  nodes,
  progressMessage,
  synthesisData,
  completeData,
  proposal,
  language,
  selectedNodeId,
  onSelectNode,
}: Props) {
  const isZh = language.startsWith("zh");
  const separators = computeSeparators(nodes);
  const sepMap = new Map(separators.map((s) => [s.insertBeforeIndex, s.label]));

  function handleExportJSON() {
    const data = { proposal, nodes, synthesisData, completeData };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const topic = (proposal?.topic ?? "export").replace(
      /[^a-zA-Z0-9\u4e00-\u9fff-]/g,
      "_",
    );
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `chrono-${topic}-${ts}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Progress bar */}
      {!completeData && progressMessage && (
        <div className="mb-8">
          <div className="h-0.5 w-full overflow-hidden rounded-full bg-chrono-border">
            <div className="h-full w-1/3 animate-indeterminate rounded-full bg-chrono-accent" />
          </div>
          <p className="mt-3 text-center text-chrono-caption text-chrono-text-muted">
            {progressMessage}
          </p>
        </div>
      )}

      {/* Complete status */}
      {completeData && (
        <div className="mb-8 flex items-center justify-center gap-3 text-chrono-caption text-chrono-text-muted">
          <span>
            {isZh
              ? `调研完成 · ${completeData.total_nodes} 个节点 · ${completeData.detail_completed} 个已补充详情`
              : `Research complete · ${completeData.total_nodes} nodes · ${completeData.detail_completed} enriched`}
          </span>
          <button
            onClick={handleExportJSON}
            className="rounded border border-chrono-border px-2 py-0.5 text-chrono-tiny text-chrono-text-muted transition-colors hover:border-chrono-border-active hover:text-chrono-text-secondary"
          >
            Export JSON
          </button>
        </div>
      )}

      {/* Synthesis summary */}
      {synthesisData && (
        <div className="mb-10 animate-fade-in rounded-lg border border-chrono-border bg-chrono-surface/50 p-6">
          <h3 className="mb-3 text-chrono-caption font-medium text-chrono-text-secondary">
            {isZh ? "调研总结" : "Research Summary"}
          </h3>
          <p className="mb-4 text-chrono-body leading-relaxed text-chrono-text">
            {synthesisData.summary}
          </p>
          <p className="text-chrono-caption italic text-chrono-text-secondary">
            {synthesisData.key_insight}
          </p>
          <div className="mt-4 flex gap-4 text-chrono-tiny text-chrono-text-muted">
            <span>{synthesisData.timeline_span}</span>
            <span>&middot;</span>
            <span>
              {isZh
                ? `${synthesisData.source_count} 个来源`
                : `${synthesisData.source_count} sources`}
            </span>
          </div>
          {synthesisData.verification_notes.length > 0 && (
            <div className="mt-3 text-chrono-tiny text-chrono-accent/70">
              {synthesisData.verification_notes.map((note, i) => (
                <p key={i}>{note}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Timeline */}
      <div className="relative">
        {/* Continuous vertical line */}
        <div className="absolute left-20 top-0 bottom-0 w-px bg-chrono-timeline" />

        {nodes.map((node, index) => {
          const sepLabel = sepMap.get(index);
          return (
            <div key={node.id}>
              {/* Year separator */}
              {sepLabel && (
                <div className="mb-4 flex items-center">
                  <div className="w-16 shrink-0" />
                  <div className="flex w-8 shrink-0 justify-center">
                    <div className="h-px w-6 bg-chrono-border" />
                  </div>
                  <span className="text-chrono-caption font-medium text-chrono-text-muted">
                    {sepLabel}
                  </span>
                </div>
              )}

              {/* Node entry */}
              <div className="mb-6 flex items-start">
                {/* Date label */}
                <div className="w-16 shrink-0 pt-2 text-right text-chrono-tiny text-chrono-text-muted">
                  {node.date}
                </div>

                {/* Dot column */}
                <div className="flex w-8 shrink-0 justify-center pt-2">
                  <div className={dotClass(node.significance)} />
                </div>

                {/* Card */}
                <div className="min-w-0 flex-1">
                  <TimelineNodeCard
                    node={node}
                    isSelected={selectedNodeId === node.id}
                    onSelect={onSelectNode}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
