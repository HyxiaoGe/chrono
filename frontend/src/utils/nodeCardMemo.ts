import type { TimelineNode } from "@/types";

export interface NodeCardMemoProps {
  node: TimelineNode;
  isSelected: boolean;
  isRelated: boolean;
  dimmed: boolean;
  onClick: (id: string) => void;
  onHover: (id: string | null) => void;
  side: "left" | "right";
}

export function areNodeCardPropsEqual(
  previous: NodeCardMemoProps,
  next: NodeCardMemoProps,
): boolean {
  return (
    previous.node === next.node &&
    previous.isSelected === next.isSelected &&
    previous.isRelated === next.isRelated &&
    previous.dimmed === next.dimmed &&
    previous.onClick === next.onClick &&
    previous.onHover === next.onHover &&
    previous.side === next.side
  );
}
