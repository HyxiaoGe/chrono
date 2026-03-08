import { useState, useEffect, useRef, useCallback } from "react";

export function useActiveNode(nodeIds: string[]): string | null {
  const [activeId, setActiveId] = useState<string | null>(null);
  const nodeIdsRef = useRef(nodeIds);
  nodeIdsRef.current = nodeIds;

  const findClosest = useCallback(() => {
    const ids = nodeIdsRef.current;

    // At page bottom, report last node
    const atBottom = window.innerHeight + window.scrollY >= document.body.scrollHeight - 50;
    if (atBottom && ids.length > 0) {
      setActiveId(ids[ids.length - 1]);
      return;
    }

    const viewportCenter = window.innerHeight / 2;
    let closest: string | null = null;
    let minDist = Infinity;

    for (const id of ids) {
      const el = document.getElementById(id);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (rect.bottom < -200 || rect.top > window.innerHeight + 200) continue;
      const elCenter = rect.top + rect.height / 2;
      const dist = Math.abs(elCenter - viewportCenter);
      if (dist < minDist) {
        minDist = dist;
        closest = id;
      }
    }

    if (closest) setActiveId(closest);
  }, []);

  useEffect(() => {
    if (nodeIds.length === 0) return;

    findClosest();

    const onScroll = () => findClosest();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [nodeIds, findClosest]);

  return activeId;
}
