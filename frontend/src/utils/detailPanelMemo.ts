import type { TimelineNode } from "@/types";
import type { ConnectionMap } from "@/hooks/useConnections";

export interface DetailPanelMemoProps {
  node: TimelineNode | null;
  language: string;
  connectionMap: ConnectionMap;
  onClose: () => void;
  onNavigateToNode: (id: string) => void;
}

export function areDetailPanelPropsEqual(
  previous: DetailPanelMemoProps,
  next: DetailPanelMemoProps,
): boolean {
  return (
    previous.node === next.node &&
    previous.language === next.language &&
    previous.connectionMap === next.connectionMap &&
    previous.onClose === next.onClose &&
    previous.onNavigateToNode === next.onNavigateToNode
  );
}
