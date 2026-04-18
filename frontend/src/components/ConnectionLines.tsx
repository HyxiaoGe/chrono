"use client";

import { connColor, connDash } from "@/utils/design";
import { TimelineConnection } from "@/types";

interface ConnectionLinesProps {
  connections: TimelineConnection[];
  positions: Record<string, { top: number }>;
  containerHeight: number;
  hoveredId: string | null;
}

export default function ConnectionLines({
  connections,
  positions,
  containerHeight,
  hoveredId,
}: ConnectionLinesProps) {
  const hasActive = hoveredId !== null;

  return (
    <svg
      className="absolute inset-0 w-full pointer-events-none z-0"
      style={{ height: `${containerHeight}px` }}
      viewBox={`0 0 1000 ${containerHeight}`}
      preserveAspectRatio="none"
    >
      {connections.map((conn, i) => {
        const a = positions[conn.from_id];
        const b = positions[conn.to_id];
        if (!a || !b) return null;

        const cx = 500;
        const ay = a.top;
        const by = b.top;
        const dy = Math.abs(by - ay);
        const bulge = 160 + Math.min(120, dy * 0.35);
        const sideSign = i % 2 === 0 ? -1 : 1;
        const ctrlX = cx + sideSign * bulge;

        const isActive =
          hasActive && (conn.from_id === hoveredId || conn.to_id === hoveredId);
        const isDim = hasActive && !isActive;

        return (
          <path
            key={i}
            d={`M ${cx} ${ay} C ${ctrlX} ${ay + (by - ay) * 0.2}, ${ctrlX} ${ay + (by - ay) * 0.8}, ${cx} ${by}`}
            fill="none"
            stroke={connColor(conn.type)}
            strokeWidth={isActive ? 1.6 : 1}
            strokeOpacity={isActive ? 0.9 : isDim ? 0.08 : 0.28}
            strokeDasharray={connDash(conn.type)}
            strokeLinecap="round"
            style={{ transition: "stroke-opacity .25s, stroke-width .25s" }}
          />
        );
      })}
    </svg>
  );
}
