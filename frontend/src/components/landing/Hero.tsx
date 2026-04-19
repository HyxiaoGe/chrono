"use client";

import { useState, useEffect, useRef, useMemo, Fragment } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/data/landing";
import { Icon } from "@/components/ui/Icon";
import { demoData } from "@/data/demo";

/* ================================================================== */
/*  TimelineTheater — 20s looping vertical timeline demo               */
/* ================================================================== */

const LOOP_SECONDS = 20;
const FADE_OUT_AT = 18.5;
const FADE_DURATION = 1.3;

const TIER_COLOR: Record<string, string> = {
  revolutionary: "#f0c060",
  high: "#8a9ab0",
  medium: "#71717a",
};

const CONN_COLOR: Record<string, string> = {
  caused: "#e07050",
  enabled: "#5090d0",
  inspired: "#50b080",
  responded_to: "#9070c0",
};

const CONN_LABEL: Record<string, string> = {
  caused: "caused",
  enabled: "enabled",
  inspired: "inspired",
  responded_to: "responded",
};

/* ---- Demo data derived from real database (demo.ts) ---- */

interface TheaterNode {
  id: string;
  date: string;
  year: string;
  era: number;
  title: string;
  subtitle?: string;
  sig: "revolutionary" | "high" | "medium";
  description: string;
  tags?: string[];
  enrich: number;
  phaseName: string;
}

interface TheaterConn {
  from: number;
  to: number;
  kind: string;
  startAt: number;
}

interface TheaterEra {
  label: string;
  short: string;
  nodeIds: string[];
}

/** Build theater data from demo.ts for a given locale */
function buildTheaterData(locale: Locale) {
  const demo = demoData[locale];
  const nodes: TheaterNode[] = demo.nodes.map((n, i) => ({
    id: n.id,
    date: n.date,
    year: n.date.slice(0, 4),
    era: 0, // filled below
    title: n.title,
    subtitle: n.subtitle || undefined,
    sig: n.significance as "revolutionary" | "high" | "medium",
    description: n.description,
    tags: demo.details[n.id]?.tags,
    enrich: 4.2 + i * 0.9, // stagger enrichment across 4.2–10.5s
    phaseName: n.phase_name || "",
  }));

  // Build eras from phase_name
  const phaseMap = new Map<string, string[]>();
  nodes.forEach((n) => {
    const key = n.phaseName || "Other";
    const arr = phaseMap.get(key) || [];
    arr.push(n.id);
    phaseMap.set(key, arr);
  });
  const eras: TheaterEra[] = Array.from(phaseMap.entries()).map(([label, nodeIds]) => {
    const eraNodes = nodeIds.map((id) => nodes.find((n) => n.id === id)!);
    const years = [...new Set(eraNodes.map((n) => n.year))].sort();
    const short = years.length > 1 ? `'${years[0].slice(2)}–'${years[years.length - 1].slice(2)}` : `'${years[0].slice(2)}`;
    return { label, short, nodeIds };
  });

  // Assign era index to nodes
  nodes.forEach((n) => {
    n.era = eras.findIndex((e) => e.nodeIds.includes(n.id));
  });

  // Connection arcs — link consecutive revolutionary/high nodes
  const conns: TheaterConn[] = [];
  const significantIndices = nodes
    .map((n, i) => (n.sig !== "medium" ? i : -1))
    .filter((i) => i >= 0);
  const connKinds = ["caused", "enabled", "inspired", "enabled", "inspired"];
  for (let j = 0; j < Math.min(significantIndices.length - 1, 5); j++) {
    conns.push({
      from: significantIndices[j],
      to: significantIndices[j + 1],
      kind: connKinds[j % connKinds.length],
      startAt: 11.2 + j * 0.4,
    });
  }

  // Detail for the selected node (first revolutionary node with details)
  const selectedIdx = nodes.findIndex((n) => n.sig === "revolutionary" && demo.details[n.id]);
  const selectedId = nodes[selectedIdx]?.id || nodes[0].id;
  const selectedNode = nodes.find((n) => n.id === selectedId)!;
  const details = demo.details[selectedId];

  const detail = {
    nodeId: selectedId,
    quote: details?.notable_quote || "",
    overview: selectedNode.description,
    keyStats: details?.key_stats || details?.key_features?.slice(0, 2) || [],
    keyPeople: (details?.key_people || []).slice(0, 2).map((p) => {
      const parts = p.split(" — ");
      return { name: parts[0], role: parts[1] || "" };
    }),
    connectionsOut: conns
      .filter((c) => nodes[c.from].id === selectedId)
      .map((c) => ({ targetTitle: nodes[c.to].title, rel: c.kind })),
    connectionsIn: conns
      .filter((c) => nodes[c.to].id === selectedId)
      .map((c) => ({ sourceTitle: nodes[c.from].title, rel: c.kind })),
    sources: (details?.sources || []).slice(0, 2).map((url) => {
      try {
        const u = new URL(url);
        return { domain: u.hostname.replace(/^www\./, ""), path: u.pathname.slice(0, 20) };
      } catch {
        return { domain: url, path: "" };
      }
    }),
  };

  return { nodes, eras, conns, selectedId, detail, topic: demo.proposal.topic };
}

/* ---- Hooks & helpers ---- */

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

function useLoopClock(period = LOOP_SECONDS) {
  const [t, setT] = useState(0);
  useEffect(() => {
    const start = performance.now();
    let raf: number;
    const tick = (now: number) => {
      setT(((now - start) / 1000) % period);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [period]);
  return t;
}

/* ---- Mini NodeCard (matches real product styling) ---- */

function MiniNodeCard({ node, reveal, active, selected, shimmer, side }: {
  node: TheaterNode; reveal: number; active: boolean; selected: boolean; shimmer: boolean; side: "l" | "r";
}) {
  const sig = node.sig;
  const align = side === "l" ? "text-right" : "text-left";
  const tagAlign = side === "l" ? "justify-end" : "justify-start";

  // Skeleton state
  if (reveal < 0.15) {
    if (sig === "revolutionary") {
      return (
        <div
          className={`relative overflow-hidden rounded-xl p-3 ${active ? "ring-1 ring-chrono-accent/40" : ""}`}
          style={{
            background: "linear-gradient(180deg, #27272a 0%, #18181b 100%)",
            border: "1px solid rgba(240,192,96,0.3)",
            borderLeft: "3px solid rgba(240,192,96,0.45)",
            boxShadow: active ? "0 0 16px rgba(212,160,80,0.25)" : "none",
          }}
        >
          <div className={`text-[11px] font-semibold text-chrono-revolutionary/60 ${align}`}>{node.title}</div>
          <div className="mt-2 space-y-1.5">
            <div className="shimmer h-2 w-full rounded" />
            <div className="shimmer h-2 w-4/5 rounded" />
          </div>
        </div>
      );
    }
    if (sig === "high") {
      return (
        <div className="rounded-lg border border-chrono-border/40 p-3" style={{ backgroundColor: "rgba(24,24,27,0.7)", borderLeft: `3px solid ${TIER_COLOR.high}` }}>
          <div className={`text-[11px] font-semibold text-chrono-text/40 ${align}`}>{node.title}</div>
          <div className="mt-2 space-y-1.5">
            <div className="shimmer h-2 w-full rounded" />
            <div className="shimmer h-2 w-3/5 rounded" />
          </div>
        </div>
      );
    }
    return (
      <div className="rounded-md px-2.5 py-1.5" style={{ backgroundColor: "rgba(24,24,27,0.3)", borderLeft: `2px solid ${TIER_COLOR.medium}80` }}>
        <div className={`text-[10.5px] font-medium text-chrono-text-muted/40 ${align}`}>{node.title}</div>
        <div className="mt-1.5 space-y-1">
          <div className="shimmer h-1.5 w-full rounded" />
          <div className="shimmer h-1.5 w-2/3 rounded" />
        </div>
      </div>
    );
  }

  // Revealed card — match real NodeCard styles
  const ringClass = selected ? "ring-2 ring-chrono-accent/50" : "";
  const shimmerOverlay = shimmer ? (
    <div className="absolute inset-0 pointer-events-none rounded-xl overflow-hidden" style={{
      background: "linear-gradient(110deg, transparent 30%, rgba(240,192,96,0.18) 50%, transparent 70%)",
      backgroundSize: "200% 100%", animation: "shimmerBar 0.7s linear",
    }} />
  ) : null;

  if (sig === "revolutionary") {
    return (
      <div
        className={`relative overflow-hidden rounded-xl border p-3 shadow-md ${ringClass}`}
        style={{
          background: "linear-gradient(180deg, #27272a 0%, #18181b 100%)",
          borderColor: "rgba(240,192,96,0.5)",
          borderLeft: "3px solid #f0c060",
          boxShadow: "0 4px 12px -2px rgba(240,192,96,0.1)",
          opacity: reveal, transform: `translateY(${(1 - reveal) * 4}px)`,
          transition: "opacity 240ms, transform 240ms",
        }}
      >
        <h3 className={`text-[12px] font-semibold text-chrono-revolutionary leading-tight ${align}`}>{node.title}</h3>
        {node.subtitle && <p className={`mt-0.5 text-[10px] text-chrono-text-secondary leading-tight ${align}`}>{node.subtitle}</p>}
        <p className={`mt-1.5 text-[10.5px] text-chrono-text-secondary leading-snug ${align}`}>{node.description}</p>
        {node.tags && (
          <div className={`mt-2 flex flex-wrap gap-1 ${tagAlign}`}>
            {node.tags.slice(0, 2).map((tag) => (
              <span key={tag} className="rounded-full bg-chrono-accent/10 px-1.5 py-0.5 text-[9px] text-chrono-accent">{tag}</span>
            ))}
          </div>
        )}
        {shimmerOverlay}
      </div>
    );
  }

  if (sig === "high") {
    return (
      <div
        className={`relative rounded-lg border p-2.5 ${ringClass}`}
        style={{
          backgroundColor: "rgba(24,24,27,0.7)", borderColor: "rgba(63,63,70,0.6)",
          borderLeft: `3px solid ${TIER_COLOR.high}`,
          opacity: reveal, transform: `translateY(${(1 - reveal) * 4}px)`,
          transition: "opacity 240ms, transform 240ms",
        }}
      >
        <h3 className={`text-[12px] font-semibold text-chrono-text leading-tight ${align}`}>{node.title}</h3>
        {node.subtitle && <p className={`mt-0.5 text-[10px] text-chrono-text-muted leading-tight ${align}`}>{node.subtitle}</p>}
        <p className={`mt-1.5 text-[10.5px] text-chrono-text-secondary leading-snug line-clamp-2 ${align}`}>{node.description}</p>
        {shimmerOverlay}
      </div>
    );
  }

  // medium
  return (
    <div
      className={`relative rounded-md px-2.5 py-1.5 ${ringClass}`}
      style={{
        backgroundColor: "rgba(24,24,27,0.3)", borderLeft: `2px solid ${TIER_COLOR.medium}80`,
        opacity: reveal, transform: `translateY(${(1 - reveal) * 4}px)`,
        transition: "opacity 240ms, transform 240ms",
      }}
    >
      <h3 className={`text-[11px] font-medium text-chrono-text-secondary leading-tight ${align}`}>{node.title}</h3>
      <p className={`mt-0.5 text-[10px] text-chrono-text-muted leading-tight line-clamp-1 ${align}`}>{node.description}</p>
      {shimmerOverlay}
    </div>
  );
}

/* ---- Mini AxisDot (matches real AxisDot.tsx) ---- */

function MiniAxisDot({ sig, appeared, enriched, shimmer }: {
  sig: string; appeared: number; enriched: number; shimmer: boolean;
}) {
  const color = TIER_COLOR[sig];
  if (sig === "revolutionary") {
    return (
      <div className="relative flex items-center justify-center" style={{ width: 20, height: 20, opacity: appeared }}>
        <div className="absolute rounded-full" style={{ width: 20, height: 20, background: `${color}25`, opacity: enriched }} />
        <div className="relative rounded-full" style={{
          width: 12, height: 12, background: enriched > 0.3 ? color : "#09090b",
          border: `1.5px solid ${color}`,
          boxShadow: shimmer ? `0 0 10px 2px rgba(240,192,96,.5)` : "none",
          transition: "background 300ms, box-shadow 300ms",
        }} />
      </div>
    );
  }
  if (sig === "high") {
    return (
      <div className="flex items-center justify-center" style={{ width: 20, height: 20, opacity: appeared }}>
        <div className="rounded-full ring-4 ring-chrono-bg" style={{
          width: 10, height: 10, background: enriched > 0.3 ? color : "#09090b",
          border: `1.5px solid ${color}`, transition: "background 300ms",
        }} />
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center" style={{ width: 20, height: 20, opacity: appeared }}>
      <div className="rounded-full ring-4 ring-chrono-bg" style={{
        width: 6, height: 6, background: enriched > 0.3 ? color : "#09090b",
        border: `1.5px solid ${color}`, transition: "background 300ms",
      }} />
    </div>
  );
}

/* ---- Mini EraNavigator ---- */

function MiniEraNav({ nodes, eras, nodeStates, scrollProgress }: {
  nodes: TheaterNode[];
  eras: TheaterEra[];
  nodeStates: Record<string, { appeared: number; enriched: number }>;
  scrollProgress: number;
}) {
  return (
    <div className="relative px-3 pt-2.5 pb-2 border-b border-chrono-border/40 bg-chrono-bg/60 backdrop-blur-sm">
      <div className="flex items-center gap-1">
        {eras.map((era, i) => {
          const isActive = scrollProgress >= i / eras.length && scrollProgress < (i + 1) / eras.length;
          return (
            <div key={era.label} className="flex items-center gap-1.5" style={{ width: `${100 / eras.length}%` }}>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-1 min-w-0">
                  <span className={`text-[10px] font-medium truncate ${isActive ? "text-chrono-accent" : "text-chrono-text-secondary"}`}>{era.label}</span>
                  <span className="font-mono text-[9px] text-chrono-text-muted/70 shrink-0">{era.short}</span>
                </div>
                <div className="mt-1 flex items-center gap-0.5 h-2">
                  {era.nodeIds.map((nid) => {
                    const node = nodes.find((n) => n.id === nid)!;
                    const st = nodeStates[nid] || { appeared: 0, enriched: 0 };
                    const color = TIER_COLOR[node.sig];
                    const dotSize = node.sig === "revolutionary" ? 5 : node.sig === "high" ? 4 : 3;
                    return (
                      <div key={nid} className="rounded-full" style={{
                        width: dotSize, height: dotSize,
                        background: st.enriched > 0.3 ? color : "transparent",
                        border: `1px solid ${color}`, opacity: st.appeared || 0,
                        transition: "background 300ms",
                      }} />
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 h-[2px] w-full rounded-full bg-chrono-border/40 overflow-hidden">
        <div className="h-full bg-chrono-accent/60 transition-[width] duration-100" style={{ width: `${scrollProgress * 100}%` }} />
      </div>
    </div>
  );
}

/* ---- Mini ProgressBar ---- */

function MiniProgressBar({ t, nodeStates, nodeCount }: {
  t: number; nodeStates: Record<string, { enriched: number }>; nodeCount: number;
}) {
  const phases = [
    { key: "skeleton", label: "Skeleton", startAt: 2.9, endAt: 4.3 },
    { key: "detail", label: "Detail", startAt: 4.3, endAt: 10.8 },
    { key: "analysis", label: "Analysis", startAt: 10.8, endAt: 13.2 },
    { key: "synthesis", label: "Synthesis", startAt: 13.2, endAt: 15.0 },
  ];
  const currentIdx = phases.findIndex((p) => t >= p.startAt && t < p.endAt);
  const activeIdx = currentIdx === -1 ? (t < 2.9 ? -1 : phases.length - 1) : currentIdx;

  const completed = Object.values(nodeStates).filter((s) => s.enriched > 0.85).length;
  const elapsed = Math.floor((t / LOOP_SECONDS) * 134);
  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  return (
    <div className="mx-3 mt-3 rounded-lg border border-chrono-border bg-chrono-surface/70 backdrop-blur-sm px-3 py-2">
      <div className="flex items-center gap-1">
        {phases.map((p, i) => {
          const isActive = i === activeIdx;
          const isDone = i < activeIdx;
          return (
            <div key={p.key} className="flex items-center gap-1">
              {i > 0 && <div className={`h-px w-3 ${isDone ? "bg-chrono-accent" : "bg-chrono-border"}`} />}
              <div className="flex items-center gap-1">
                <span className={`size-1.5 rounded-full ${isDone ? "bg-chrono-accent" : isActive ? "bg-chrono-accent animate-pulse" : "bg-chrono-border"}`} />
                <span className={`text-[10px] ${isActive ? "text-chrono-accent font-medium" : isDone ? "text-chrono-text-secondary" : "text-chrono-text-muted/50"}`}>{p.label}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex items-center gap-2 text-[9.5px] text-chrono-text-muted font-mono">
        <span className="rounded bg-chrono-accent/10 px-1.5 py-0.5 text-chrono-accent/80">deepseek-v3.2</span>
        {activeIdx === 1 && <span className="tabular-nums">{completed}/{nodeCount} done</span>}
        {activeIdx === 2 && <span className="text-chrono-text-secondary">finding connections…</span>}
        {activeIdx === 3 && <span className="text-chrono-text-secondary">writing summary…</span>}
        <span className="ml-auto tabular-nums">{mm}:{ss}</span>
      </div>
    </div>
  );
}

/* ---- Mini DetailPanel ---- */

function MiniDetailPanel({ openAmt, t, node, detail }: {
  openAmt: number; t: number;
  node: TheaterNode;
  detail: ReturnType<typeof buildTheaterData>["detail"];
}) {
  const reveal = clamp01((t - 11.5) / 0.5);
  if (openAmt < 0.02) return null;

  return (
    <div
      className="absolute top-0 right-0 bottom-0 border-l border-chrono-border bg-chrono-bg/97 backdrop-blur-md overflow-hidden scrollbar-hide"
      style={{ width: 230, transform: `translateX(${(1 - openAmt) * 230}px)`, transition: "transform 120ms linear" }}
    >
      {/* Header with significance accent bar */}
      <div className="shrink-0 border-b border-chrono-border/40 px-3 py-2 relative" style={{ background: `linear-gradient(180deg, ${TIER_COLOR[node.sig]}12 0%, transparent 100%)` }}>
        <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ backgroundColor: TIER_COLOR[node.sig], opacity: 0.9 }} />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-chrono-text-muted">{node.date}</span>
            <span className="rounded-full bg-chrono-revolutionary/15 text-chrono-revolutionary px-1.5 py-0.5 text-[9px] font-medium">{node.sig}</span>
          </div>
          <span className="text-chrono-text-muted text-[11px]">&times;</span>
        </div>
      </div>

      {/* Body — auto-scrolls content while panel is open */}
      <div className="px-3 py-3 overflow-hidden" style={{ opacity: reveal, maxHeight: "calc(100% - 44px)" }}>
      <div style={{
        transform: `translateY(${t > 12.0 && t < 16.5 ? -Math.min(280, (t - 12.0) * 65) : 0}px)`,
        transition: "transform 200ms linear",
      }}>
        <h2 className="text-[13px] font-semibold text-chrono-revolutionary leading-tight">{node.title}</h2>
        {node.subtitle && <p className="mt-0.5 text-[10px] text-chrono-text-secondary">{node.subtitle}</p>}
        {node.tags && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {node.tags.map((tag) => <span key={tag} className="rounded-full bg-chrono-accent/10 px-1.5 py-0.5 text-[9px] text-chrono-accent">{tag}</span>)}
          </div>
        )}

        {/* Quote — matching real DetailPanel pull-quote style */}
        <div className="mt-3 relative">
          <span className="absolute -top-1 -left-0.5 text-[28px] leading-none font-serif text-chrono-accent/30 select-none">&ldquo;</span>
          <blockquote className="pl-4 pr-1">
            <p className="text-[10px] italic text-chrono-text leading-snug">{detail.quote}</p>
          </blockquote>
        </div>

        {/* Overview */}
        <div className="mt-3">
          <div className="h-px bg-chrono-border/30 mb-2" />
          <div className="text-[8.5px] uppercase tracking-wider text-chrono-text-secondary font-semibold mb-1">Overview</div>
          <p className="text-[10px] text-chrono-text-secondary leading-snug">{detail.overview}</p>
        </div>

        {/* Key Stats */}
        <div className="mt-3">
          <div className="h-px bg-chrono-border/30 mb-2" />
          <div className="text-[8.5px] uppercase tracking-wider text-chrono-text-secondary font-semibold mb-1">Key Stats</div>
          <ul className="space-y-1">
            {detail.keyStats.map((s, i) => (
              <li key={i} className="rounded-md bg-chrono-bg/40 px-2 py-1">
                <span className="text-[9.5px] text-chrono-text-secondary leading-tight">{s}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Key People */}
        <div className="mt-3">
          <div className="h-px bg-chrono-border/30 mb-2" />
          <div className="text-[8.5px] uppercase tracking-wider text-chrono-text-secondary font-semibold mb-1">Key People</div>
          <ul className="space-y-1">
            {detail.keyPeople.map((p, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-chrono-border/50 bg-chrono-bg/40 text-[8px] font-semibold text-chrono-text-secondary font-mono">
                  {p.name.split(" ").map((w) => w[0]).join("")}
                </span>
                <span className="text-[9.5px] leading-tight">
                  <span className="font-medium text-chrono-text">{p.name}</span>
                  <span className="text-chrono-text-muted"> — {p.role}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Connected Moments */}
        <div className="mt-3">
          <div className="h-px bg-chrono-border/30 mb-2" />
          <div className="text-[8.5px] uppercase tracking-wider text-chrono-accent/90 font-semibold mb-1">Connected Moments</div>
          <div className="text-[8.5px] text-chrono-text-muted/70 mb-0.5">&rarr; Led to</div>
          {detail.connectionsOut.map((c, i) => (
            <div key={i} className="flex items-center gap-1 rounded px-1 py-0.5">
              <span className="flex-1 text-[9.5px] text-chrono-text-secondary truncate">{c.targetTitle}</span>
              <span className="rounded-full bg-chrono-inspired/15 text-chrono-inspired px-1.5 py-0.5 text-[8.5px]">{c.rel}</span>
            </div>
          ))}
          <div className="text-[8.5px] text-chrono-text-muted/70 mb-0.5 mt-1">&larr; Shaped by</div>
          {detail.connectionsIn.map((c, i) => (
            <div key={i} className="flex items-center gap-1 rounded px-1 py-0.5">
              <span className="flex-1 text-[9.5px] text-chrono-text-secondary truncate">{c.sourceTitle}</span>
              <span className="rounded-full bg-chrono-enabled/15 text-chrono-enabled px-1.5 py-0.5 text-[8.5px]">{c.rel}</span>
            </div>
          ))}
        </div>

        {/* Sources */}
        <div className="mt-3">
          <div className="h-px bg-chrono-border/30 mb-2" />
          <div className="text-[8.5px] uppercase tracking-wider text-chrono-text-secondary font-semibold mb-1">Sources</div>
          <ul className="space-y-0.5">
            {detail.sources.map((s, i) => (
              <li key={i} className="flex items-center gap-1.5 px-1 py-0.5">
                <span className="size-1.5 shrink-0 rounded-full bg-chrono-border" />
                <span className="text-[9.5px] truncate">
                  <span className="text-chrono-text-secondary">{s.domain}</span>
                  <span className="text-chrono-text-muted"> &rsaquo; {s.path}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      </div>
    </div>
  );
}

/* ---- TimelineTheater ---- */

function TimelineTheater({ locale }: { locale: Locale }) {
  const t = useLoopClock();
  const data = useMemo(() => buildTheaterData(locale), [locale]);
  const { nodes: THEATER_NODES, eras: THEATER_ERAS, conns: THEATER_CONNS, selectedId: SELECTED_ID, detail: THEATER_DETAIL, topic } = data;

  const CARD_H = 560;
  const HEADER_H = 40;
  const ERA_H = 48;
  const PROGRESS_H = 58;
  const TIMELINE_TOP = HEADER_H + ERA_H + PROGRESS_H + 10;
  const SPINE_X = 305;
  const TIMELINE_W = 610;

  // Query typing
  const queryLen = Math.min(topic.length, Math.floor((t / 2.2) * topic.length));
  const queryText = t < 2.3 ? topic.slice(0, queryLen) : topic;
  const submitFlash = t > 2.3 && t < 2.75;

  // Node states
  const nodeStates: Record<string, { appeared: number; enriched: number; shimmer: boolean; activeNow: boolean }> = {};
  THEATER_NODES.forEach((n, i) => {
    const appearT = 2.9 + (i / THEATER_NODES.length) * 1.1;
    const appeared = clamp01((t - appearT) / 0.3);
    const enriched = clamp01((t - n.enrich) / 0.7);
    const shimmer = t > n.enrich && t < n.enrich + 0.7;
    const activeNow = t > n.enrich - 0.6 && t < n.enrich + 0.1;
    nodeStates[n.id] = { appeared, enriched, shimmer, activeNow };
  });

  // Vertical positions — increased spacing to prevent overlap
  const NODE_SPACING = 120;
  const nodePos = THEATER_NODES.map((n, i) => ({ id: n.id, side: (i % 2 === 0 ? "l" : "r") as "l" | "r", y: i * NODE_SPACING + 20 }));
  const TOTAL_TL_H = THEATER_NODES.length * NODE_SPACING + 80;
  const VIEWPORT_H = CARD_H - TIMELINE_TOP;

  // Auto-scroll
  let scrollY = 0;
  if (t < 3.5) {
    scrollY = 0;
  } else if (t < 11.0) {
    let latestIdx = 0;
    THEATER_NODES.forEach((n, i) => { if (t >= n.enrich - 0.3) latestIdx = i; });
    scrollY = Math.max(0, Math.min(TOTAL_TL_H - VIEWPORT_H, nodePos[latestIdx].y - VIEWPORT_H * 0.55));
  } else {
    const selIdx = THEATER_NODES.findIndex((n) => n.id === SELECTED_ID);
    scrollY = Math.max(0, Math.min(TOTAL_TL_H - VIEWPORT_H, nodePos[selIdx].y - VIEWPORT_H * 0.3));
  }

  const scrollProgress = TOTAL_TL_H > VIEWPORT_H ? scrollY / (TOTAL_TL_H - VIEWPORT_H) : 0;

  // DetailPanel timing
  const panelOpen = t < 11.0 ? 0 : t < 11.6 ? clamp01((t - 11.0) / 0.6) : t < 16.5 ? 1 : t < 17.2 ? clamp01(1 - (t - 16.5) / 0.7) : 0;

  // Connection arcs
  const connStates = THEATER_CONNS.map((c) => ({ ...c, draw: clamp01((t - c.startAt) / 0.7) }));

  // Agent ticker
  const agents = ["Orchestrator", "Milestone", "Detail", "Gap", "Connector", "Synthesizer"];
  const agentIdx = t < 2.8 ? 0 : t < 4.2 ? 1 : t < 10.5 ? 2 + Math.floor(((t - 4.2) / 6.3) * 2) : t < 13.2 ? 4 : 5;
  const activeAgent = agents[Math.min(agentIdx, agents.length - 1)];
  const completedCount = Object.values(nodeStates).filter((s) => s.enriched > 0.85).length;

  // Crossfade
  let cardOpacity = 1;
  if (t >= FADE_OUT_AT) cardOpacity = Math.max(0, 1 - (t - FADE_OUT_AT) / FADE_DURATION);
  else if (t < 0.8) cardOpacity = clamp01(t / 0.8);

  return (
    <div className="relative rounded-2xl border border-chrono-border/60 bg-chrono-bg/40 overflow-hidden" style={{
      height: CARD_H, boxShadow: "0 20px 60px -20px rgba(0,0,0,0.6), 0 0 0 1px rgba(212,160,80,0.04) inset",
    }}>
      <div style={{ opacity: cardOpacity, height: "100%" }}>
        {/* Header bar */}
        <div className="relative z-30 flex items-center gap-3 px-3 h-10 border-b border-chrono-border/40 bg-chrono-bg/80 backdrop-blur-sm">
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-chrono-border" />
            <span className="size-2 rounded-full bg-chrono-border" />
            <span className="size-2 rounded-full bg-chrono-border" />
          </div>
          <div className="flex items-center gap-1.5 rounded-md bg-chrono-surface/60 border border-chrono-border/40 px-2 py-0.5">
            <Icon name="search" size={10} />
            <span className="font-mono text-[10px] text-chrono-text-secondary">
              {queryText}
              {t < 2.3 && <span className="inline-block w-[1px] h-[10px] bg-chrono-accent align-[-1px] ml-[1px] caret" />}
            </span>
            <span className="ml-1 text-[9px] font-medium px-1 py-0.5 rounded bg-chrono-accent/15 text-chrono-accent" style={{
              opacity: queryText.length === topic.length ? 1 : 0.25, transition: "opacity 200ms",
              boxShadow: submitFlash ? "0 0 12px rgba(212,160,80,0.45)" : "none",
            }}>
              research &rarr;
            </span>
          </div>
          <div className="ml-auto flex items-center gap-2 font-mono text-[10px]">
            <span className="inline-flex items-center gap-1 text-chrono-accent">
              <span className="size-1.5 rounded-full bg-chrono-accent animate-pulse" />
              {activeAgent}
            </span>
            <span className="text-chrono-border">&middot;</span>
            <span className="text-chrono-text-muted tabular-nums">
              <span className="text-chrono-text-secondary">{String(completedCount).padStart(2, "0")}</span>
              <span className="text-chrono-border/70"> / </span>
              <span>{THEATER_NODES.length}</span>
            </span>
          </div>
        </div>

        <MiniEraNav nodes={THEATER_NODES} eras={THEATER_ERAS} nodeStates={nodeStates} scrollProgress={scrollProgress} />
        <MiniProgressBar t={t} nodeStates={nodeStates} nodeCount={THEATER_NODES.length} />

        {/* Timeline viewport */}
        <div className="relative" style={{ height: VIEWPORT_H }}>
          <div className="absolute inset-0 overflow-hidden">
            <div className="relative" style={{
              width: TIMELINE_W, height: TOTAL_TL_H,
              transform: `translateY(${-scrollY}px)`,
              transition: "transform 300ms cubic-bezier(0.4, 0, 0.2, 1)",
            }}>
              {/* Vertical spine */}
              <div className="absolute top-0 bottom-0 w-px bg-chrono-border/60" style={{ left: SPINE_X, opacity: clamp01((t - 2.7) / 0.4) }} />

              {/* Connection arcs */}
              <svg className="absolute inset-0 overflow-visible" width={TIMELINE_W} height={TOTAL_TL_H} style={{ pointerEvents: "none" }}>
                {connStates.map((c, i) => {
                  const y1 = nodePos[c.from].y + 20;
                  const y2 = nodePos[c.to].y + 20;
                  const bulgeDir = c.to % 2 === 0 ? -1 : 1;
                  const bulge = 26 + Math.abs(c.to - c.from) * 4;
                  const midY = (y1 + y2) / 2;
                  const d = `M ${SPINE_X} ${y1} C ${SPINE_X + bulgeDir * bulge} ${y1 + 12}, ${SPINE_X + bulgeDir * bulge} ${y2 - 12}, ${SPINE_X} ${y2}`;
                  const color = CONN_COLOR[c.kind];
                  return (
                    <g key={i} style={{ opacity: c.draw }}>
                      <path d={d} stroke={color} strokeWidth="1.3" fill="none" strokeDasharray="260" strokeDashoffset={260 - c.draw * 260} opacity="0.75" />
                      {c.draw > 0.6 && (
                        <text x={SPINE_X + bulgeDir * bulge} y={midY} fill={color} fontSize="8.5" fontFamily="Geist Mono, ui-monospace, monospace"
                          textAnchor={bulgeDir > 0 ? "start" : "end"} dx={bulgeDir > 0 ? 3 : -3}
                          opacity={clamp01((c.draw - 0.6) / 0.4) * 0.85}>
                          {CONN_LABEL[c.kind]}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>

              {/* Nodes */}
              {THEATER_NODES.map((n, i) => {
                const pos = nodePos[i];
                const st = nodeStates[n.id];
                const prevYear = i > 0 ? THEATER_NODES[i - 1].year : null;
                const showYearSep = prevYear !== null && prevYear !== n.year && st.appeared > 0;
                return (
                  <div key={n.id} className="absolute left-0 right-0" style={{ top: pos.y }}>
                    {showYearSep && (
                      <div className="absolute left-0 right-0 flex items-center gap-2 px-2" style={{ top: -22, opacity: st.appeared }}>
                        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-chrono-border to-chrono-border/30" />
                        <span className="font-mono text-[10px] text-chrono-text-secondary tabular-nums">{n.year}</span>
                        <span className="text-chrono-text-muted text-[9px]">&middot; {THEATER_ERAS[n.era].label}</span>
                        <div className="flex-1 h-px bg-gradient-to-l from-transparent via-chrono-border to-chrono-border/30" />
                      </div>
                    )}
                    <div className="grid items-start" style={{ gridTemplateColumns: "1fr 20px 1fr", columnGap: 12 }}>
                      <div className="flex justify-end" style={{ paddingRight: 4 }}>
                        {pos.side === "l" && (
                          <div style={{ width: "100%", maxWidth: 230 }}>
                            <div className="mb-0.5 text-[9px] font-mono text-chrono-text-muted/80 text-right">{n.date}</div>
                            <MiniNodeCard node={n} reveal={st.enriched} active={st.activeNow} selected={n.id === SELECTED_ID && panelOpen > 0.4} shimmer={st.shimmer} side="l" />
                          </div>
                        )}
                      </div>
                      <div className="flex justify-center pt-1.5">
                        <MiniAxisDot sig={n.sig} appeared={st.appeared} enriched={st.enriched} shimmer={st.shimmer} />
                      </div>
                      <div style={{ paddingLeft: 4 }}>
                        {pos.side === "r" && (
                          <div style={{ width: "100%", maxWidth: 230 }}>
                            <div className="mb-0.5 text-[9px] font-mono text-chrono-text-muted/80 text-left">{n.date}</div>
                            <MiniNodeCard node={n} reveal={st.enriched} active={st.activeNow} selected={n.id === SELECTED_ID && panelOpen > 0.4} shimmer={st.shimmer} side="r" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

            </div>

            {/* Edge fades */}
            <div className="pointer-events-none absolute top-0 left-0 right-0 h-6 bg-gradient-to-b from-chrono-bg/70 to-transparent" />
            <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-chrono-bg/30 to-transparent" />
          </div>

          <MiniDetailPanel openAmt={panelOpen} t={t} node={THEATER_NODES.find((n) => n.id === SELECTED_ID)!} detail={THEATER_DETAIL} />
        </div>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  HeroSearch                                                         */
/* ================================================================== */

const HERO_SUGGESTIONS = ["iPhone", "Cold War", "Bitcoin", "Roman Empire", "Quantum Mechanics", "World Wide Web", "Space Race", "CRISPR"];

function HeroSearch({ locale }: { locale: Locale }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [focus, setFocus] = useState(false);
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const isZh = locale === "zh";

  useEffect(() => {
    if (q) return;
    const timer = setInterval(() => setPlaceholderIdx((i) => (i + 1) % HERO_SUGGESTIONS.length), 2200);
    return () => clearInterval(timer);
  }, [q]);

  const placeholder = isZh ? `试试 "${HERO_SUGGESTIONS[placeholderIdx]}"…` : `Try "${HERO_SUGGESTIONS[placeholderIdx]}"…`;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = q.trim();
    if (!trimmed) return;
    router.push(`/app/session/new?topic=${encodeURIComponent(trimmed)}`);
  };

  return (
    <form onSubmit={submit} className={`relative w-full max-w-xl mx-auto transition-all ${focus ? "scale-[1.005]" : ""}`}>
      <div className={`relative flex items-center bg-chrono-surface/80 backdrop-blur-md border rounded-xl transition-colors ${focus ? "border-chrono-accent/60 shadow-lg shadow-chrono-accent/10" : "border-chrono-border/70"}`}>
        <span className="pl-5 text-chrono-text-muted"><Icon name="search" size={18} /></span>
        <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
          placeholder={placeholder} className="flex-1 bg-transparent pl-3 pr-3 py-4 text-chrono-subtitle text-chrono-text placeholder:text-chrono-text-muted/70 outline-none" />
        <div className="mr-2 flex items-center gap-2">
          <span className="hidden sm:inline text-chrono-tiny text-chrono-text-muted/70 font-mono px-2 py-1 rounded border border-chrono-border/50">⌘ K</span>
          <button type="submit" disabled={!q.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-chrono-accent px-4 py-2 text-chrono-caption font-medium text-chrono-bg hover:bg-chrono-accent/90 disabled:opacity-50 transition-opacity cursor-pointer">
            {isZh ? "调研" : "Research"} <Icon name="arrowRight" size={14} strokeWidth={2} />
          </button>
        </div>
      </div>
    </form>
  );
}

/* ================================================================== */
/*  Hero                                                               */
/* ================================================================== */

interface Props { locale: Locale }

export function Hero({ locale }: Props) {
  const isZh = locale === "zh";

  return (
    <section className="relative overflow-hidden">
      {/* Ambient glows */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-[-18%] left-1/2 -translate-x-1/2 h-[560px] w-[900px] rounded-full bg-chrono-accent/[0.05] blur-[120px]" />
        <div className="absolute top-[14%] left-[10%] h-[240px] w-[240px] rounded-full bg-chrono-accent/[0.03] blur-[90px]" />
        <div className="absolute top-[6%] right-[10%] h-[200px] w-[200px] rounded-full bg-chrono-enabled/[0.025] blur-[90px]" />
      </div>

      {/* BAND 1: Hero text + search */}
      <div className="relative mx-auto max-w-5xl px-8 pt-28 pb-12 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-chrono-border/60 bg-chrono-surface/40 backdrop-blur-sm pl-1 pr-3 py-1 text-chrono-tiny">
          <span className="inline-flex items-center gap-1 rounded-full bg-chrono-accent/10 text-chrono-accent px-2 py-0.5 font-medium">
            <span className="size-1.5 rounded-full bg-chrono-accent animate-pulse" />New
          </span>
          <span className="text-chrono-text-secondary">{isZh ? "多智能体调研 · 流式时间线" : "Multi-agent research · streaming timelines"}</span>
          <span className="text-chrono-text-muted"> &rarr; </span>
          <span className="text-chrono-accent/80">{isZh ? "阅读发布说明" : "Read the launch note"}</span>
        </div>

        <h1 className="mt-8 text-[64px] leading-[1.03] font-bold tracking-[-0.02em] text-chrono-text">
          {isZh ? "将任何主题转化为" : "Turn any topic into"}
        </h1>
        <h1 className="text-[64px] leading-[1.03] font-bold tracking-[-0.02em] text-chrono-accent">
          {isZh ? "一条交互式时间线" : "an interactive timeline"}
        </h1>

        <p className="mt-6 text-chrono-subtitle text-chrono-text-secondary max-w-xl mx-auto">
          {isZh
            ? "输入主题 — AI 智能体并行调研，流式输出有来源支撑的时间线，包含 15 到 150+ 里程碑事件，只需几分钟。"
            : "Enter a topic — AI agents research it in parallel and stream back a source-backed timeline of 15 to 150+ milestones in minutes, not hours."}
        </p>

        <div className="mt-10">
          <HeroSearch locale={locale} />
        </div>

        <div className="mt-6 text-chrono-tiny text-chrono-text-muted/70">
          {isZh ? "每个节点引用原始来源" : "Every node cites primary sources"}
          <span className="mx-2 text-chrono-border/70">&middot;</span>
          <span className="font-mono">deepseek-v3.2 &middot; gpt-4.1 &middot; claude-sonnet-4.5</span>
        </div>
      </div>

      {/* BAND 2: Theater */}
      <div className="relative mx-auto max-w-6xl px-8 pb-24">
        <div className="mb-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="text-chrono-tiny font-medium uppercase tracking-[0.05em] text-chrono-accent/80 inline-flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-chrono-accent animate-pulse" />
            {isZh ? "观看时间线自动构建" : "Watch a timeline build itself"}
          </div>
          <span className="font-mono text-chrono-tiny text-chrono-text-muted">
            query: <span className="text-chrono-text-secondary">{demoData[locale].proposal.topic}</span> &middot; replaying at 10&times;
          </span>
        </div>
        <TimelineTheater locale={locale} />
        <p className="mt-4 text-chrono-caption text-chrono-text-muted text-center max-w-2xl mx-auto">
          {isZh
            ? "节点随着智能体完成而流式出现。重要性层级、年份锚点和因果关联并行解析 — 实际运行约需 2–8 分钟。"
            : "Nodes stream in as agents finish them. Significance tiers, year anchors, and causal links resolve in parallel — the real thing runs in ~2–8 minutes depending on depth."}
        </p>
      </div>
    </section>
  );
}
