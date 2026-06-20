import { useState, useEffect, useRef, useCallback } from "react";
import { chooseActiveNodeId } from "@/utils/activeNode";
import { createRafThrottle } from "@/utils/rafThrottle";

export function useActiveNode(nodeIds: string[]): string | null {
  const [activeId, setActiveId] = useState<string | null>(null);
  const nodeIdsRef = useRef(nodeIds);

  useEffect(() => {
    nodeIdsRef.current = nodeIds;
  }, [nodeIds]);

  const findClosest = useCallback(() => {
    const ids = nodeIdsRef.current;
    const closest = chooseActiveNodeId({
      nodeIds: ids,
      viewportHeight: window.innerHeight,
      scrollY: window.scrollY,
      documentHeight: document.body.scrollHeight,
      getRect: (id) => {
        const el = document.getElementById(id);
        return el?.getBoundingClientRect() ?? null;
      },
    });

    if (closest) setActiveId(closest);
  }, []);

  useEffect(() => {
    if (nodeIds.length === 0) return;

    findClosest();

    const onScroll = createRafThrottle(findClosest);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      onScroll.cancel();
      window.removeEventListener("scroll", onScroll);
    };
  }, [nodeIds, findClosest]);

  return activeId;
}
