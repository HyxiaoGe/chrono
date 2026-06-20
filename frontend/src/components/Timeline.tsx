"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { TimelineNode, TimelineConnection } from "@/types";
import NodeCard from "@/components/NodeCard";
import AxisDot from "@/components/AxisDot";
import YearSeparator from "@/components/YearSeparator";
import ConnectionLines from "@/components/ConnectionLines";
import {
  keepPreviousTimelineMeasurementIfEqual,
  type TimelineMeasurement,
} from "@/utils/timelineMeasurement";
import {
  buildTimelineConnectionIndex,
  type IndexedTimelineConnection,
} from "@/utils/timelineConnections";
import { areTimelinePropsEqual } from "@/utils/timelineMemo";

interface TimelineProps {
  nodes: TimelineNode[];
  connections: TimelineConnection[];
  selectedId: string | null;
  hoveredId: string | null;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}

type SepRow = { kind: "sep"; year: number; era?: string | null; key: string };
type NodeRow = {
  kind: "node";
  node: TimelineNode;
  side: "left" | "right";
  key: string;
};
type Row = SepRow | NodeRow;

const EMPTY_RELATED_IDS = new Set<string>();
const EMPTY_INDEXED_CONNECTIONS: IndexedTimelineConnection[] = [];
const NODE_ID_SEPARATOR = "\u001f";

function getNodeIdSignature(nodes: TimelineNode[]): string {
  return nodes.map((node) => node.id).join(NODE_ID_SEPARATOR);
}

function getNodeIdsFromSignature(signature: string): string[] {
  return signature ? signature.split(NODE_ID_SEPARATOR) : [];
}

function TimelineComponent({
  nodes,
  connections,
  selectedId,
  hoveredId,
  onSelect,
  onHover,
}: TimelineProps) {
  const [measurement, setMeasurement] = useState<TimelineMeasurement>({
    positions: {},
    containerHeight: 0,
  });
  const innerRef = useRef<HTMLDivElement>(null);
  const nodeIdSignature = useMemo(() => getNodeIdSignature(nodes), [nodes]);
  const nodeIds = useMemo(
    () => getNodeIdsFromSignature(nodeIdSignature),
    [nodeIdSignature],
  );

  // Measure node vertical positions for SVG connection overlay
  useEffect(() => {
    let frameId: number | null = null;

    const measure = () => {
      frameId = null;
      const inner = innerRef.current;
      if (!inner) return;
      const rect = inner.getBoundingClientRect();
      const pos: Record<string, { top: number }> = {};
      nodeIds.forEach((id) => {
        const el = inner.querySelector<HTMLElement>(
          `[data-node-id="${id}"]`,
        );
        if (el) {
          const er = el.getBoundingClientRect();
          pos[id] = { top: er.top - rect.top + er.height / 2 };
        }
      });
      setMeasurement((current) =>
        keepPreviousTimelineMeasurementIfEqual(current, {
          positions: pos,
          containerHeight: rect.height,
        }),
      );
    };

    const scheduleMeasure = () => {
      if (frameId !== null) return;
      frameId = requestAnimationFrame(measure);
    };

    scheduleMeasure();
    const ro = new ResizeObserver(scheduleMeasure);
    if (innerRef.current) ro.observe(innerRef.current);
    window.addEventListener("resize", scheduleMeasure);
    return () => {
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }
      ro.disconnect();
      window.removeEventListener("resize", scheduleMeasure);
    };
  }, [nodeIds]);

  // Build rows: year separators + alternating node cards
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    let prevYear: number | null = null;
    nodes.forEach((n, idx) => {
      const year = parseInt(n.date.slice(0, 4), 10);
      if (prevYear === null || year !== prevYear) {
        out.push({ kind: "sep", year, key: `y-${year}-${idx}` });
      }
      out.push({
        kind: "node",
        node: n,
        side: idx % 2 === 0 ? "right" : "left",
        key: n.id,
      });
      prevYear = year;
    });
    return out;
  }, [nodes]);

  // Related node highlighting -- only active on hover (not selection alone)
  const activeId = hoveredId;
  const connectionIndex = useMemo(
    () => buildTimelineConnectionIndex(connections),
    [connections],
  );
  const activeConnectionEntry = activeId ? connectionIndex.get(activeId) : undefined;
  const related = useMemo(() => {
    return activeConnectionEntry?.relatedIds ?? EMPTY_RELATED_IDS;
  }, [activeConnectionEntry]);
  const activeConnections =
    activeConnectionEntry?.connections ?? EMPTY_INDEXED_CONNECTIONS;

  const hasActive = !!activeId;

  return (
    <div className="relative">
      <div ref={innerRef} className="relative">
        {/* Central axis line */}
        <div className="absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2 bg-chrono-border/60" />

        {/* SVG connection overlay */}
        <ConnectionLines
          connections={activeConnections}
          positions={measurement.positions}
          containerHeight={measurement.containerHeight}
        />

        {/* Rows */}
        <div className="relative z-10">
          {rows.map((r) => {
            if (r.kind === "sep") {
              return (
                <YearSeparator key={r.key} year={r.year} era={r.era} />
              );
            }

            const n = r.node;
            const side = r.side;
            const isSel = selectedId === n.id;
            const isRel = related.has(n.id);
            const dimmed =
              hasActive && !isSel && !isRel && activeId !== n.id;

            return (
              <div
                key={r.key}
                className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-4 mb-5"
              >
                {/* Left cell */}
                <div className="flex justify-end pr-4">
                  {side === "left" ? (
                    <div
                      id={n.id}
                      className="w-full max-w-[440px]"
                      data-node-id={n.id}
                    >
                      <NodeCard
                        node={n}
                        isSelected={isSel}
                        isRelated={isRel}
                        dimmed={dimmed}
                        onClick={onSelect}
                        onHover={onHover}
                        side="left"
                      />
                    </div>
                  ) : null}
                </div>

                {/* Axis dot */}
                <div className="relative flex items-center justify-center w-6">
                  <AxisDot significance={n.significance} />
                </div>

                {/* Right cell */}
                <div className="flex justify-start pl-4">
                  {side === "right" ? (
                    <div
                      id={n.id}
                      className="w-full max-w-[440px]"
                      data-node-id={n.id}
                    >
                      <NodeCard
                        node={n}
                        isSelected={isSel}
                        isRelated={isRel}
                        dimmed={dimmed}
                        onClick={onSelect}
                        onHover={onHover}
                        side="right"
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export const Timeline = memo(TimelineComponent, areTimelinePropsEqual);
