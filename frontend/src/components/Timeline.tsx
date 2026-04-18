"use client";

import { useState, useMemo, useLayoutEffect, useRef } from "react";
import type { TimelineNode, TimelineConnection } from "@/types";
import NodeCard from "@/components/NodeCard";
import AxisDot from "@/components/AxisDot";
import YearSeparator from "@/components/YearSeparator";
import ConnectionLines from "@/components/ConnectionLines";

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

export function Timeline({
  nodes,
  connections,
  selectedId,
  hoveredId,
  onSelect,
  onHover,
}: TimelineProps) {
  const [positions, setPositions] = useState<Record<string, { top: number }>>(
    {},
  );
  const [containerH, setContainerH] = useState(0);
  const innerRef = useRef<HTMLDivElement>(null);

  // Measure node vertical positions for SVG connection overlay
  useLayoutEffect(() => {
    const measure = () => {
      const inner = innerRef.current;
      if (!inner) return;
      const rect = inner.getBoundingClientRect();
      const pos: Record<string, { top: number }> = {};
      nodes.forEach((n) => {
        const el = inner.querySelector<HTMLElement>(
          `[data-node-id="${n.id}"]`,
        );
        if (el) {
          const er = el.getBoundingClientRect();
          pos[n.id] = { top: er.top - rect.top + er.height / 2 };
        }
      });
      setPositions(pos);
      setContainerH(rect.height);
    };

    measure();
    const ro = new ResizeObserver(measure);
    if (innerRef.current) ro.observe(innerRef.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [nodes]);

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
  const related = useMemo(() => {
    if (!activeId) return new Set<string>();
    const s = new Set<string>();
    connections.forEach((c) => {
      if (c.from_id === activeId) s.add(c.to_id);
      if (c.to_id === activeId) s.add(c.from_id);
    });
    return s;
  }, [activeId, connections]);

  const hasActive = !!activeId;

  return (
    <div className="relative">
      <div ref={innerRef} className="relative">
        {/* Central axis line */}
        <div className="absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2 bg-chrono-border/60" />

        {/* SVG connection overlay */}
        <ConnectionLines
          connections={connections}
          positions={positions}
          containerHeight={containerH}
          hoveredId={hoveredId}
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
