"use client";

import { connColor, connDash } from "@/utils/design";
import type { IndexedTimelineConnection } from "@/utils/timelineConnections";

interface ConnectionLinesProps {
  connections: IndexedTimelineConnection[];
  positions: Record<string, { top: number }>;
  containerHeight: number;
}

export default function ConnectionLines({
  connections,
  positions,
  containerHeight,
}: ConnectionLinesProps) {
  return (
    <svg
      className="absolute inset-0 w-full pointer-events-none z-0"
      style={{ height: `${containerHeight}px` }}
      viewBox={`0 0 1000 ${containerHeight}`}
      preserveAspectRatio="none"
    >
      {connections.map(({ connection, index }) => {
        const a = positions[connection.from_id];
        const b = positions[connection.to_id];
        if (!a || !b) return null;

        const cx = 500;
        const ay = a.top;
        const by = b.top;
        const dy = Math.abs(by - ay);
        const bulge = 160 + Math.min(120, dy * 0.35);
        const sideSign = index % 2 === 0 ? -1 : 1;
        const ctrlX = cx + sideSign * bulge;

        return (
          <path
            key={index}
            d={`M ${cx} ${ay} C ${ctrlX} ${ay + (by - ay) * 0.2}, ${ctrlX} ${ay + (by - ay) * 0.8}, ${cx} ${by}`}
            fill="none"
            stroke={connColor(connection.type)}
            strokeWidth={1.6}
            strokeOpacity={0.9}
            strokeDasharray={connDash(connection.type)}
            strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
}
