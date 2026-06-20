"use client";

import { useState, useMemo, useRef, useLayoutEffect } from "react";
import type { TimelineNode } from "@/types";
import { sigColor } from "@/utils/design";
import {
  buildEraNavigationState,
  selectCurrentEraKey,
} from "@/utils/eraNavigation";

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface EraNavigatorProps {
  nodes: TimelineNode[];
  activeNodeId: string | null;
  hoveredId: string | null;
  onJumpToNode: (id: string) => void;
  onHoverNode: (id: string | null) => void;
  scrollTop: number;
  scrollHeight: number;
  viewportHeight: number;
  language: string;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function EraNavigator({
  nodes,
  activeNodeId,
  hoveredId,
  onJumpToNode,
  onHoverNode,
  scrollTop,
  scrollHeight,
  viewportHeight,
  language,
}: EraNavigatorProps) {
  const isZh = language.startsWith("zh");
  const [hoverEra, setHoverEra] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);

  // Publish actual height as CSS variable so DetailPanel can align
  useLayoutEffect(() => {
    const measure = () => {
      if (navRef.current) {
        const h = navRef.current.offsetHeight;
        document.documentElement.style.setProperty("--era-nav-bottom", `${56 + h}px`);
      }
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [nodes.length]);

  const eraNavigation = useMemo(() => buildEraNavigationState(nodes), [nodes]);
  const eraData = eraNavigation.eras;

  // scroll progress 0..1
  const progress = scrollHeight > viewportHeight ? scrollTop / (scrollHeight - viewportHeight) : 0;

  // determine current era from activeNode or scroll position
  const currentEra = useMemo(
    () => selectCurrentEraKey(eraNavigation, { activeNodeId, progress }),
    [activeNodeId, eraNavigation, progress],
  );

  if (eraData.length === 0) return null;

  return (
    <nav
      ref={navRef}
      aria-label={isZh ? "时间线章节" : "Timeline chapters"}
      className="sticky top-14 z-30 -mx-6 mb-6 px-5 py-2.5 bg-chrono-bg/85 backdrop-blur-md border-b border-chrono-border/40"
    >
      <div className="flex items-stretch">
        {/* Leading label */}
        <div className="shrink-0 flex items-center gap-1.5 pr-3 mr-2 border-r border-chrono-border/30">
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className="text-chrono-text-muted"
          >
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
          <span className="text-chrono-tiny uppercase tracking-wider text-chrono-text-muted font-medium">
            {isZh ? "章节" : "Eras"}
          </span>
        </div>

        {/* Era segments */}
        <div className="flex-1 flex items-stretch gap-0.5 relative min-w-0">
          {eraData.map((era) => {
            const isCurrent = era.key === currentEra;
            const isHover = era.key === hoverEra;
            const yearRange =
              era.years.length > 1
                ? `'${String(era.years[0]).slice(2)}–'${String(era.years[era.years.length - 1]).slice(2)}`
                : `'${String(era.years[0]).slice(2)}`;

            return (
              <button
                key={era.key}
                aria-current={isCurrent ? "true" : undefined}
                onMouseEnter={() => setHoverEra(era.key)}
                onMouseLeave={() => setHoverEra(null)}
                onClick={() => era.firstNodeId && onJumpToNode(era.firstNodeId)}
                className={`group relative flex flex-col justify-between rounded-md px-2 py-1.5 text-left transition-colors ${
                  isCurrent ? "bg-chrono-accent/[0.09]" : "hover:bg-chrono-surface/60"
                }`}
                style={{ flex: `${era.weight} 1 0`, minWidth: 0 }}
              >
                {/* Row 1: label */}
                <div className="flex items-baseline gap-1.5 min-w-0">
                  <span
                    className={`text-chrono-tiny font-semibold truncate ${
                      isCurrent
                        ? "text-chrono-accent"
                        : "text-chrono-text-secondary group-hover:text-chrono-text"
                    }`}
                  >
                    {era.label}
                  </span>
                  <span className="text-[10px] font-mono tabular-nums text-chrono-text-muted/60 shrink-0">
                    {yearRange}
                  </span>
                  {era.revolutionaryCount > 0 && (
                    <span className="ml-auto text-[9px] font-mono text-chrono-revolutionary/70 shrink-0">
                      ★{era.revolutionaryCount}
                    </span>
                  )}
                </div>

                {/* Row 2: node dots */}
                <div className="mt-1 flex items-center gap-[3px] min-w-0 overflow-hidden">
                  {era.nodes.map((n) => {
                    const isActiveNode = n.id === activeNodeId;
                    const isHoveredNode = n.id === hoveredId;
                    const color = sigColor(n.significance);
                    const w = n.significance === "revolutionary" ? 8 : n.significance === "high" ? 5 : 3.5;
                    return (
                      <span
                        key={n.id}
                        role="button"
                        tabIndex={0}
                        aria-label={`${n.date.slice(0, 7)} · ${n.title}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onJumpToNode(n.id);
                        }}
                        onMouseEnter={(e) => {
                          e.stopPropagation();
                          onHoverNode(n.id);
                        }}
                        onMouseLeave={(e) => {
                          e.stopPropagation();
                          onHoverNode(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            e.stopPropagation();
                            onJumpToNode(n.id);
                          }
                        }}
                        title={`${n.date.slice(0, 7)} · ${n.title}`}
                        className="inline-block rounded-full cursor-pointer transition-all hover:scale-125 shrink-0"
                        style={{
                          width: `${w}px`,
                          height: `${w}px`,
                          backgroundColor: color,
                          boxShadow: isActiveNode
                            ? "0 0 0 1.5px rgba(212,160,80,.9)"
                            : isHoveredNode
                            ? "0 0 0 1px rgba(250,250,250,.6)"
                            : n.significance === "revolutionary"
                            ? `0 0 4px 0 ${color}90`
                            : "none",
                          opacity: isActiveNode || isHoveredNode ? 1 : 0.85,
                        }}
                      />
                    );
                  })}
                </div>

                {/* Hover peek popover */}
                {isHover && era.nodes.length > 0 && (
                  <div className="absolute left-0 top-full mt-1 z-[100] rounded-lg border border-chrono-border/60 bg-chrono-surface-hover shadow-xl shadow-black/60 p-2 min-w-[240px]">
                    <div className="text-chrono-tiny uppercase tracking-wider text-chrono-text-muted/70 mb-1.5 px-1">
                      {era.caption}
                    </div>
                    <ul className="max-h-[220px] overflow-y-auto">
                      {era.nodes.map((n) => (
                        <li key={n.id}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onJumpToNode(n.id);
                            }}
                            className="w-full flex items-center gap-2 rounded px-1.5 py-1 text-left hover:bg-chrono-bg/50"
                          >
                            <span
                              className="shrink-0 rounded-full"
                              style={{
                                width: `${n.significance === "revolutionary" ? 8 : 5}px`,
                                height: `${n.significance === "revolutionary" ? 8 : 5}px`,
                                backgroundColor: sigColor(n.significance),
                              }}
                            />
                            <span className="text-[10px] font-mono text-chrono-text-muted/80 tabular-nums shrink-0">
                              {n.date.slice(0, 7)}
                            </span>
                            <span className="text-chrono-tiny text-chrono-text-secondary truncate">
                              {n.title}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Scroll progress bar */}
      <div className="mt-1.5 h-0.5 rounded-full bg-chrono-border/20 overflow-hidden relative" aria-hidden="true">
        <div
          className="absolute inset-y-0 left-0 bg-chrono-accent/70 rounded-full transition-[width] duration-100"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
        {eraNavigation.markerPositions.map((marker) => (
          <span
            key={marker.key}
            className="absolute top-0 bottom-0 w-px bg-chrono-border/40"
            style={{ left: `${marker.left}%` }}
          />
        ))}
      </div>
    </nav>
  );
}
