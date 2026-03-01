import { useState, useEffect, useRef } from "react";

export function useActiveNode(nodeIds: string[]): string | null {
  const [activeId, setActiveId] = useState<string | null>(null);
  const visibleRef = useRef<Map<string, IntersectionObserverEntry>>(new Map());

  useEffect(() => {
    if (nodeIds.length === 0) return;

    visibleRef.current.clear();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            visibleRef.current.set(entry.target.id, entry);
          } else {
            visibleRef.current.delete(entry.target.id);
          }
        }

        if (visibleRef.current.size === 0) return;

        const viewportCenter = window.innerHeight / 2;
        let closest: string | null = null;
        let minDist = Infinity;

        for (const [id, entry] of visibleRef.current) {
          const rect = entry.target.getBoundingClientRect();
          const elCenter = rect.top + rect.height / 2;
          const dist = Math.abs(elCenter - viewportCenter);
          if (dist < minDist) {
            minDist = dist;
            closest = id;
          }
        }

        setActiveId(closest);
      },
      {
        rootMargin: "-20% 0px -20% 0px",
        threshold: [0, 0.5, 1],
      },
    );

    for (const id of nodeIds) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [nodeIds]);

  return activeId;
}
