"use client";

import { useState, useMemo } from "react";
import type {
  TimelineNode,
  SynthesisData,
  CompleteData,
  ResearchProposal,
} from "@/types";
import type { ConnectionMap } from "@/hooks/useConnections";
import type { PhaseGroup } from "@/utils/timeline";
import { computeDenseGroups } from "@/utils/timeline";
import { TimelineNodeCard } from "./TimelineNode";
import { DenseGroupBlock } from "./DenseGroup";
import { ExportDropdown } from "./ExportDropdown";

interface Props {
  nodes: TimelineNode[];
  progressMessage: string;
  synthesisData: SynthesisData | null;
  completeData: CompleteData | null;
  proposal: ResearchProposal | null;
  language: string;
  selectedNodeId: string | null;
  highlightedNodeId: string | null;
  onSelectNode: (id: string) => void;
  connectionMap: ConnectionMap;
  phaseGroups: PhaseGroup[];
}

// --- Year separators ---

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

// --- Dot class ---

function dotClass(sig: string): string {
  if (sig === "revolutionary") {
    return "h-4 w-4 rounded-full bg-chrono-revolutionary ring-4 ring-chrono-revolutionary/20";
  }
  if (sig === "high") {
    return "h-3 w-3 rounded-full bg-chrono-high";
  }
  return "h-2 w-2 rounded-full bg-chrono-medium";
}

// --- Collapsible section ---

function CollapsibleSection({
  title,
  count,
  children,
  language,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
  language: string;
}) {
  const [open, setOpen] = useState(false);
  const isZh = language.startsWith("zh");
  return (
    <div className="mt-3">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-chrono-tiny text-chrono-text-muted transition-colors hover:text-chrono-text-secondary"
      >
        <span>{open ? "▾" : "▸"}</span>
        <span>{title}</span>
        <span className="rounded-full bg-chrono-border px-1.5 py-0.5 text-chrono-tiny">
          {count} {isZh ? "条" : ""}
        </span>
      </button>
      {open && <div className="mt-2 space-y-1 pl-4">{children}</div>}
    </div>
  );
}

// --- Synthesis block ---

function SynthesisBlock({
  synthesisData,
  nodes,
  connections,
  dateCorrections,
  language,
  isZh,
}: {
  synthesisData: SynthesisData;
  nodes: TimelineNode[];
  connections: SynthesisData["connections"];
  dateCorrections: SynthesisData["date_corrections"];
  language: string;
  isZh: boolean;
}) {
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const longSummary = synthesisData.summary.length > 200;

  return (
    <div className="mb-8 animate-fade-in rounded-lg border border-chrono-border bg-chrono-surface/50 px-6 py-4">
      <h3 className="mb-2 text-chrono-caption font-medium text-chrono-text-secondary">
        {isZh ? "调研总结" : "Research Summary"}
      </h3>
      <p
        className={`mb-2 text-chrono-body leading-relaxed text-chrono-text ${summaryExpanded ? "" : "line-clamp-3"}`}
      >
        {synthesisData.summary}
      </p>
      {longSummary && (
        <button
          onClick={() => setSummaryExpanded(!summaryExpanded)}
          className="mb-2 text-chrono-tiny text-chrono-text-muted transition-colors hover:text-chrono-text-secondary"
        >
          {summaryExpanded ? (isZh ? "收起" : "Less") : (isZh ? "展开全文" : "More")}
        </button>
      )}
      <p className="text-chrono-caption italic text-chrono-text-secondary">
        {synthesisData.key_insight}
      </p>

      {/* Stats dashboard */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-chrono-tiny text-chrono-text-muted">
        <span>
          <span className="text-chrono-text">{nodes.length}</span>{" "}
          {isZh ? "节点" : "nodes"}
        </span>
        <span>
          <span className="text-chrono-text">
            {synthesisData.source_count}
          </span>{" "}
          {isZh ? "来源" : "sources"}
        </span>
        {connections && connections.length > 0 && (
          <span>
            <span className="text-chrono-text">
              {connections.length}
            </span>{" "}
            {isZh ? "因果关系" : "connections"}
          </span>
        )}
        {dateCorrections && dateCorrections.length > 0 && (
          <span>
            <span className="text-chrono-text">
              {dateCorrections.length}
            </span>{" "}
            {isZh ? "日期修正" : "corrections"}
          </span>
        )}
        <span>{synthesisData.timeline_span}</span>
      </div>

      {/* Verification notes — collapsible */}
      {synthesisData.verification_notes.length > 0 && (
        <CollapsibleSection
          title={isZh ? "验证备注" : "Verification Notes"}
          count={synthesisData.verification_notes.length}
          language={language}
        >
          {synthesisData.verification_notes.map((note, i) => (
            <p key={i} className="text-chrono-tiny text-chrono-text-muted">
              {note}
            </p>
          ))}
        </CollapsibleSection>
      )}

      {/* Date corrections collapsible */}
      {dateCorrections && dateCorrections.length > 0 && (
        <CollapsibleSection
          title={isZh ? "日期修正记录" : "Date Corrections"}
          count={dateCorrections.length}
          language={language}
        >
          {dateCorrections.map((corr) => {
            const nodeTitle =
              nodes.find((n) => n.id === corr.node_id)?.title ??
              corr.node_id;
            return (
              <div
                key={corr.node_id}
                className="text-chrono-tiny text-chrono-text-muted"
              >
                {nodeTitle}: {corr.original_date} → {corr.corrected_date}
                <span className="ml-2 opacity-60">({corr.reason})</span>
              </div>
            );
          })}
        </CollapsibleSection>
      )}
    </div>
  );
}

// --- Main component ---

export function Timeline({
  nodes,
  progressMessage,
  synthesisData,
  completeData,
  proposal,
  language,
  selectedNodeId,
  highlightedNodeId,
  onSelectNode,
  connectionMap,
  phaseGroups,
}: Props) {
  const isZh = language.startsWith("zh");
  const separators = computeSeparators(nodes);

  const denseGroups = useMemo(() => computeDenseGroups(nodes), [nodes]);
  const denseNodeSet = useMemo(
    () => new Set(denseGroups.flatMap((g) => g.nodeIds)),
    [denseGroups],
  );
  const denseGroupMap = useMemo(
    () => new Map(denseGroups.map((g) => [g.startIndex, g])),
    [denseGroups],
  );

  // Build set of indices inside dense groups (for separator suppression)
  const denseInnerIndices = useMemo(() => {
    const set = new Set<number>();
    for (const g of denseGroups) {
      for (let i = g.startIndex + 1; i <= g.endIndex; i++) set.add(i);
    }
    return set;
  }, [denseGroups]);

  const phaseStartSet = new Set(phaseGroups.map((g) => g.startIndex));
  const filteredSeparators = separators.filter(
    (s) =>
      !phaseStartSet.has(s.insertBeforeIndex) &&
      !denseInnerIndices.has(s.insertBeforeIndex),
  );
  const sepMap = new Map(
    filteredSeparators.map((s) => [s.insertBeforeIndex, s.label]),
  );
  const phaseMap = new Map(phaseGroups.map((g) => [g.startIndex, g]));

  const connections = synthesisData?.connections;
  const dateCorrections = synthesisData?.date_corrections;

  return (
    <div id="chrono-timeline" className="mx-auto max-w-3xl px-4 py-8">
      {/* Progress bar */}
      {!completeData && progressMessage && (
        <div className="mb-8" data-export-hide>
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
          <ExportDropdown
            proposal={proposal}
            nodes={nodes}
            synthesisData={synthesisData}
            completeData={completeData}
            phaseGroups={phaseGroups}
            timelineContainerId="chrono-timeline"
            language={language}
          />
        </div>
      )}

      {/* Synthesis summary */}
      {synthesisData && (
        <SynthesisBlock
          synthesisData={synthesisData}
          nodes={nodes}
          connections={connections}
          dateCorrections={dateCorrections}
          language={language}
          isZh={isZh}
        />
      )}

      {/* Timeline */}
      <div className="relative">
        {/* Continuous vertical line */}
        <div className="absolute left-20 top-0 bottom-0 w-px bg-chrono-timeline" />

        {nodes.map((node, index) => {
          // Skip nodes inside a dense group (but not the first node)
          if (denseNodeSet.has(node.id) && !denseGroupMap.has(index)) return null;

          const sepLabel = sepMap.get(index);
          const phaseGroup = phaseMap.get(index);
          const denseGroup = denseGroupMap.get(index);

          if (denseGroup) {
            return (
              <div key={`dense-${denseGroup.startIndex}`}>
                {/* Phase header */}
                {phaseGroup && (
                  <div className={`mb-6 ${index > 0 ? "mt-12" : ""}`}>
                    <div className="mb-4 h-px bg-gradient-to-r from-transparent via-chrono-border to-transparent" />
                    <div className="flex items-start">
                      <div className="w-16 shrink-0" />
                      <div className="w-8 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <h2 className="text-chrono-title font-semibold text-chrono-text">
                          {phaseGroup.name}
                        </h2>
                        <span className="text-chrono-caption text-chrono-text-muted">
                          {phaseGroup.timeRange}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                {/* Year separator before group */}
                {sepLabel && (
                  <div className="mb-4 flex items-center">
                    <div className="w-16 shrink-0" />
                    <div className="flex w-8 shrink-0 justify-center">
                      <div className="h-px w-6 bg-chrono-border" />
                    </div>
                    <span className="pl-1 text-chrono-body font-medium text-chrono-text-secondary">
                      {sepLabel}
                    </span>
                  </div>
                )}
                <DenseGroupBlock
                  group={denseGroup}
                  nodes={nodes}
                  selectedNodeId={selectedNodeId}
                  highlightedNodeId={highlightedNodeId}
                  onSelectNode={onSelectNode}
                  connectionMap={connectionMap}
                  language={language}
                />
              </div>
            );
          }

          const connInfo = connectionMap.get(node.id);
          const connCount = connInfo
            ? connInfo.outgoing.length + connInfo.incoming.length
            : 0;

          return (
            <div
              key={node.id}
              id={node.id}
            >
              {/* Phase header */}
              {phaseGroup && (
                <div
                  className={`mb-6 ${index > 0 ? "mt-12" : ""}`}
                >
                  <div className="mb-4 h-px bg-gradient-to-r from-transparent via-chrono-border to-transparent" />
                  <div className="flex items-start">
                    <div className="w-16 shrink-0" />
                    <div className="w-8 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <h2 className="text-chrono-title font-semibold text-chrono-text">
                        {phaseGroup.name}
                      </h2>
                      <span className="text-chrono-caption text-chrono-text-muted">
                        {phaseGroup.timeRange}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Year separator */}
              {sepLabel && (
                <div className="mb-4 flex items-center">
                  <div className="w-16 shrink-0" />
                  <div className="flex w-8 shrink-0 justify-center">
                    <div className="h-px w-6 bg-chrono-border" />
                  </div>
                  <span className="pl-1 text-chrono-body font-medium text-chrono-text-secondary">
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
                    isHighlighted={highlightedNodeId === node.id}
                    connectionCount={connCount}
                    onSelect={onSelectNode}
                    language={language}
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
