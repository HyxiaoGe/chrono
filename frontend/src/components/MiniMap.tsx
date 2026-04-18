"use client";

import { useRef } from "react";
import type { TimelineNode, TimelineConnection } from "@/types";
import { sigColor, connColor, connDash } from "@/utils/design";

interface MiniMapProps {
  nodes: TimelineNode[];
  connections: TimelineConnection[];
  selectedId: string | null;
  hoveredId: string | null;
  onHover: (id: string | null) => void;
  onJumpTo: (id: string) => void;
  scrollTop: number;
  scrollHeight: number;
  viewportHeight: number;
  language: string;
}

export function MiniMap({
  nodes,
  connections,
  selectedId,
  hoveredId,
  onHover,
  onJumpTo,
  scrollTop,
  scrollHeight,
  viewportHeight,
  language,
}: MiniMapProps) {
  const isZh = language.startsWith("zh");
  const mapRef = useRef<HTMLDivElement>(null);
  const height = 560;

  // Viewport indicator: map scroll position to minimap
  const ratio = scrollHeight > viewportHeight ? scrollTop / (scrollHeight - viewportHeight) : 0;
  const vpH = scrollHeight > 0 ? Math.max(40, (viewportHeight / scrollHeight) * height) : 40;
  const vpTop = ratio * (height - vpH);

  // Position each node vertically by its index
  const positions = nodes.map((n, i) => ({
    ...n,
    y: 20 + (i / Math.max(1, nodes.length - 1)) * (height - 40),
  }));

  // Year labels from first/last node dates
  const firstYearLabel = nodes.length > 0 ? `'${nodes[0].date.slice(2, 4)}` : null;
  const lastYearLabel = nodes.length > 0 ? `'${nodes[nodes.length - 1].date.slice(2, 4)}` : null;

  return (
    <div className="sticky top-20 w-[72px] shrink-0 self-start">
      {/* Header */}
      <div className="mb-3 flex items-center gap-1.5 px-2">
        <span className="text-chrono-tiny uppercase tracking-wider text-chrono-text-muted font-medium">{isZh ? "导航" : "Map"}</span>
        <span className="text-chrono-tiny text-chrono-text-muted/60 font-mono tabular-nums">{nodes.length}</span>
      </div>

      {/* Map container */}
      <div
        ref={mapRef}
        className="relative rounded-lg border border-chrono-border/40 bg-chrono-surface/30 backdrop-blur-sm overflow-hidden"
        style={{ height: `${height}px` }}
      >
        {/* Central spine */}
        <div className="absolute left-1/2 top-4 bottom-4 w-px bg-chrono-border/50 -translate-x-1/2" />

        {/* SVG connection strokes */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox={`0 0 72 ${height}`}
          preserveAspectRatio="none"
        >
          {connections.map((c, i) => {
            const a = positions.find((p) => p.id === c.from_id);
            const b = positions.find((p) => p.id === c.to_id);
            if (!a || !b) return null;
            const side = i % 2 === 0 ? 52 : 20;
            return (
              <path
                key={i}
                d={`M 36 ${a.y} C ${side} ${(a.y + b.y) / 2}, ${side} ${(a.y + b.y) / 2}, 36 ${b.y}`}
                fill="none"
                stroke={connColor(c.type)}
                strokeWidth="0.8"
                strokeOpacity="0.35"
                strokeDasharray={connDash(c.type)}
              />
            );
          })}
        </svg>

        {/* Viewport indicator */}
        <div
          className="absolute left-1 right-1 rounded-md border border-chrono-accent/30 bg-chrono-accent/[0.06] pointer-events-none transition-all"
          style={{ top: `${vpTop}px`, height: `${vpH}px` }}
        />

        {/* Year labels */}
        {firstYearLabel && (
          <div className="absolute top-2 left-2 text-chrono-tiny font-mono text-chrono-text-muted/60 tabular-nums">
            {firstYearLabel}
          </div>
        )}
        {lastYearLabel && (
          <div className="absolute bottom-2 left-2 text-chrono-tiny font-mono text-chrono-text-muted/60 tabular-nums">
            {lastYearLabel}
          </div>
        )}

        {/* Node dots */}
        {positions.map((n) => {
          const isSelected = n.id === selectedId;
          const isHovered = n.id === hoveredId;
          const color = sigColor(n.significance);
          const size =
            n.significance === "revolutionary" ? 7 : n.significance === "high" ? 5 : 3.5;

          return (
            <button
              key={n.id}
              onClick={() => onJumpTo(n.id)}
              onMouseEnter={() => onHover(n.id)}
              onMouseLeave={() => onHover(null)}
              className="absolute left-1/2 group"
              style={{ top: `${n.y}px`, transform: "translate(-50%, -50%)" }}
              title={`${n.date.slice(0, 7)} · ${n.title}`}
            >
              <span
                className="block rounded-full transition-all"
                style={{
                  width: `${size}px`,
                  height: `${size}px`,
                  backgroundColor: color,
                  boxShadow: isSelected
                    ? `0 0 0 2px rgba(212,160,80,.8), 0 0 10px 2px ${color}80`
                    : isHovered
                    ? `0 0 0 1.5px rgba(250,250,250,.4)`
                    : n.significance === "revolutionary"
                    ? `0 0 6px 0 ${color}80`
                    : "none",
                }}
              />
            </button>
          );
        })}

        {/* Hover tooltip */}
        {hoveredId &&
          (() => {
            const n = positions.find((p) => p.id === hoveredId);
            if (!n) return null;
            return (
              <div
                className="absolute left-[calc(100%+8px)] whitespace-nowrap z-10 pointer-events-none"
                style={{ top: `${n.y}px`, transform: "translateY(-50%)" }}
              >
                <div className="rounded-md border border-chrono-border bg-chrono-surface-hover px-2.5 py-1.5 shadow-lg">
                  <div className="text-chrono-tiny font-mono text-chrono-text-muted tabular-nums">
                    {n.date}
                  </div>
                  <div className="text-chrono-caption text-chrono-text font-medium">{n.title}</div>
                </div>
              </div>
            );
          })()}
      </div>

      {/* Legend */}
      <div className="mt-3 space-y-1.5 px-2">
        <div className="flex items-center gap-1.5">
          <span className="h-[7px] w-[7px] rounded-full bg-chrono-revolutionary shadow-[0_0_4px_0_#f0c06080]" />
          <span className="text-chrono-tiny text-chrono-text-muted">{isZh ? "突破" : "Revolutionary"}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-[5px] w-[5px] rounded-full bg-chrono-high" />
          <span className="text-chrono-tiny text-chrono-text-muted">{isZh ? "重要" : "High"}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-[3.5px] w-[3.5px] rounded-full bg-chrono-medium" />
          <span className="text-chrono-tiny text-chrono-text-muted">{isZh ? "一般" : "Medium"}</span>
        </div>
      </div>
    </div>
  );
}
