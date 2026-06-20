import type { TimelineConnection, TimelineNode } from "@/types";

export interface TimelineMemoProps {
  nodes: TimelineNode[];
  connections: TimelineConnection[];
  selectedId: string | null;
  hoveredId: string | null;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}

export function areTimelinePropsEqual(
  prev: TimelineMemoProps,
  next: TimelineMemoProps,
): boolean {
  return (
    prev.nodes === next.nodes &&
    prev.connections === next.connections &&
    prev.selectedId === next.selectedId &&
    prev.hoveredId === next.hoveredId &&
    prev.onSelect === next.onSelect &&
    prev.onHover === next.onHover
  );
}
