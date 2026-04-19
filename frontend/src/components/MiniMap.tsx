"use client";

import { useRef, useState, useLayoutEffect } from "react";
import type { TimelineNode } from "@/types";
import { sigColor } from "@/utils/design";

interface MiniMapProps {
  nodes: TimelineNode[];
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
  const [height, setHeight] = useState(640);

  // Measure actual rendered height so node positions scale correctly
  useLayoutEffect(() => {
    const measure = () => {
      if (mapRef.current) setHeight(mapRef.current.clientHeight);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (mapRef.current) ro.observe(mapRef.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  // Viewport indicator
  const ratio = scrollHeight > viewportHeight ? scrollTop / (scrollHeight - viewportHeight) : 0;
  const vpH = scrollHeight > 0 ? Math.max(48, (viewportHeight / scrollHeight) * height) : 48;
  const vpTop = ratio * (height - vpH);

  // Position each node vertically by its index
  const topPad = 28;
  const botPad = 28;
  const positions = nodes.map((n, i) => ({
    ...n,
    y: topPad + (i / Math.max(1, nodes.length - 1)) * (height - topPad - botPad),
    year: parseInt(n.date.slice(0, 4), 10),
  }));

  // Year labels — show every year
  const yearMarkers = (() => {
    const seen = new Map<number, number>();
    positions.forEach((p) => {
      if (!seen.has(p.year)) seen.set(p.year, p.y);
    });
    return Array.from(seen.entries());
  })();

  const width = 128;
  const cx = width / 2;

  return (
    <div className="sticky top-20 w-[128px] shrink-0 self-start" style={{ height: "calc(100vh - 6rem)" }}>
      {/* Header */}
      <div className="mb-2.5 flex items-center justify-between px-2">
        <span className="text-chrono-tiny uppercase tracking-wider text-chrono-text-muted font-medium">
          {isZh ? "导航" : "Map"}
        </span>
        <span className="text-chrono-tiny text-chrono-text-muted/60 font-mono tabular-nums">{nodes.length}</span>
      </div>

      {/* Map container */}
      <div
        ref={mapRef}
        className="relative rounded-lg border border-chrono-border/40 bg-chrono-surface/30 backdrop-blur-sm overflow-hidden"
        style={{ height: "calc(100% - 30px)" }}
      >
        {/* Central spine */}
        <div
          className="absolute top-4 bottom-4 w-px bg-chrono-border/50"
          style={{ left: `${cx}px` }}
        />

        {/* Year labels (no gridlines) */}
        {yearMarkers.map(([yr, y]) => (
          <span
            key={yr}
            className="absolute left-1.5 text-[11px] font-mono text-chrono-text-muted/60 tabular-nums pointer-events-none"
            style={{ top: `${y - 7}px` }}
          >
            {String(yr).slice(2)}
          </span>
        ))}

        {/* Viewport indicator */}
        <div
          className="absolute left-1.5 right-1.5 rounded-md border border-chrono-accent/40 bg-chrono-accent/[0.07] pointer-events-none transition-[top] duration-100"
          style={{ top: `${vpTop}px`, height: `${vpH}px` }}
        />

        {/* Node dots */}
        {positions.map((n) => {
          const isSelected = n.id === selectedId;
          const isHovered = n.id === hoveredId;
          const color = sigColor(n.significance);
          const size = n.significance === "revolutionary" ? 11 : n.significance === "high" ? 8 : 5.5;
          const hit = 20;

          return (
            <button
              key={n.id}
              onClick={() => onJumpTo(n.id)}
              onMouseEnter={() => onHover(n.id)}
              onMouseLeave={() => onHover(null)}
              className="absolute rounded-full flex items-center justify-center"
              style={{
                left: `${cx}px`,
                top: `${n.y}px`,
                width: `${hit}px`,
                height: `${hit}px`,
                transform: "translate(-50%, -50%)",
              }}
              title={`${n.date.slice(0, 7)} · ${n.title}`}
            >
              <span
                className="block rounded-full transition-all"
                style={{
                  width: `${size}px`,
                  height: `${size}px`,
                  backgroundColor: color,
                  boxShadow: isSelected
                    ? `0 0 0 2px rgba(212,160,80,.85), 0 0 12px 2px ${color}90`
                    : isHovered
                    ? `0 0 0 1.5px rgba(250,250,250,.5)`
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
                <div className="rounded-md border border-chrono-border bg-chrono-surface-hover px-2.5 py-1.5 shadow-xl shadow-black/40">
                  <div className="text-chrono-tiny font-mono text-chrono-text-muted tabular-nums">
                    {n.date}
                  </div>
                  <div className="text-chrono-caption text-chrono-text font-medium">{n.title}</div>
                </div>
              </div>
            );
          })()}
      </div>

    </div>
  );
}
