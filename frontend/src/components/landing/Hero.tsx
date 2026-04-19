"use client";

import { useState, useEffect, useRef, Fragment } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/data/landing";
import { Icon } from "@/components/ui/Icon";

/* ------------------------------------------------------------------ */
/*  Demo data                                                          */
/* ------------------------------------------------------------------ */

interface DemoNode {
  id: number;
  x: number;
  side: number; // +1 = above spine, -1 = below
  year: string;
  tier: "revolutionary" | "high" | "medium";
  title: string;
  enrich: number;
  agent: string;
}
interface DemoConn {
  from: number;
  to: number;
  kind: string;
  startAt: number;
}

const DEMO_NODES: DemoNode[] = [
  { id: 0, x: 60,  side: +1, year: "1401", tier: "revolutionary", title: "Ghiberti's Baptistery Doors", enrich: 3.2, agent: "Milestone" },
  { id: 1, x: 180, side: -1, year: "1436", tier: "high",          title: "Brunelleschi · Duomo",         enrich: 4.1, agent: "Detail" },
  { id: 2, x: 300, side: +1, year: "1450", tier: "high",          title: "Gutenberg press",              enrich: 3.8, agent: "Milestone" },
  { id: 3, x: 430, side: -1, year: "1492", tier: "revolutionary", title: "Columbus · New World",         enrich: 5.4, agent: "Detail" },
  { id: 4, x: 560, side: +1, year: "1503", tier: "medium",        title: "Mona Lisa begun",              enrich: 6.3, agent: "Gap" },
  { id: 5, x: 680, side: -1, year: "1517", tier: "revolutionary", title: "Luther · 95 Theses",           enrich: 4.8, agent: "Milestone" },
  { id: 6, x: 800, side: +1, year: "1543", tier: "high",          title: "Copernicus · heliocentrism",   enrich: 5.9, agent: "Detail" },
  { id: 7, x: 920, side: -1, year: "1599", tier: "medium",        title: "Globe Theatre opens",          enrich: 7.1, agent: "Gap" },
];

const DEMO_CONNS: DemoConn[] = [
  { from: 0, to: 2, kind: "inspired",  startAt: 8.1 },
  { from: 2, to: 5, kind: "enabled",   startAt: 8.5 },
  { from: 3, to: 6, kind: "inspired",  startAt: 9.0 },
  { from: 5, to: 7, kind: "responded", startAt: 9.4 },
];

const TIER_COLOR: Record<string, string> = {
  revolutionary: "#f0c060",
  high: "#8a9ab0",
  medium: "#71717a",
};
const CONN_COLOR: Record<string, string> = {
  caused: "#e07050",
  enabled: "#5090d0",
  inspired: "#50b080",
  responded: "#9070c0",
};

const LOOP_SECONDS = 12;
const QUERY = "Renaissance";

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

/* ------------------------------------------------------------------ */
/*  TimelineTheater — 12s looping animated demo                        */
/* ------------------------------------------------------------------ */

function TimelineTheater() {
  const t = useLoopClock();

  const CARD_H = 360;
  const SPINE_Y = 180;
  const CONTENT_W = 1000;

  // Phase helpers
  const queryLen = Math.min(QUERY.length, Math.floor((t / 1.6) * QUERY.length));
  const queryText = t < 1.8 ? QUERY.slice(0, queryLen) : QUERY;
  const submitFlash = t > 1.75 && t < 2.05;

  const spineOpacity = clamp01((t - 1.9) / 0.5);
  const synthOpacity = clamp01((t - 10.2) / 0.5) * (t > 11.4 ? Math.max(0, 1 - (t - 11.4) / 0.6) : 1);
  const masterFade = t > 11.4 ? Math.max(0, 1 - (t - 11.4) / 0.6) : 1;

  // Active agent ticker
  const agents = ["Orchestrator", "Milestone", "Detail", "Gap", "Synthesizer"];
  const agentIdx = t < 2.0 ? 0 : t < 8.0 ? 1 + Math.floor(((t - 2.0) / 6.0) * 3) : t < 10.0 ? 3 : 4;
  const activeAgent = agents[Math.min(agentIdx, agents.length - 1)];

  // Elapsed counter
  const elapsedTotal = Math.floor((t / LOOP_SECONDS) * 120);
  const mm = String(Math.floor(elapsedTotal / 60)).padStart(2, "0");
  const ss = String(elapsedTotal % 60).padStart(2, "0");

  const nodesLanded = DEMO_NODES.filter((n) => t > n.enrich + 0.6).length;

  return (
    <div
      className="relative rounded-2xl border border-chrono-border/60 bg-chrono-surface/30 overflow-hidden"
      style={{
        height: CARD_H,
        boxShadow: "0 20px 60px -20px rgba(0,0,0,0.6), 0 0 0 1px rgba(212,160,80,0.04) inset",
      }}
    >
      {/* Theater chrome bar */}
      <div className="relative z-10 flex items-center gap-3 px-4 h-10 border-b border-chrono-border/40 bg-chrono-bg/40 backdrop-blur-sm">
        <div className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-chrono-border" />
          <span className="size-2 rounded-full bg-chrono-border" />
          <span className="size-2 rounded-full bg-chrono-border" />
        </div>
        <span className="text-chrono-tiny font-medium uppercase tracking-[0.05em] text-chrono-text-muted">Live session</span>
        <span className="text-chrono-border">&middot;</span>
        <span className="font-mono text-[10px] text-chrono-text-muted">chrono.app/research/renaissance</span>

        <div className="ml-auto flex items-center gap-3 font-mono text-[10px]">
          <span className="inline-flex items-center gap-1.5 text-chrono-accent">
            <span className="size-1.5 rounded-full bg-chrono-accent animate-pulse" />
            {activeAgent}
          </span>
          <span className="text-chrono-border">&middot;</span>
          <span className="text-chrono-text-muted">{mm}:{ss}</span>
          <span className="text-chrono-border">&middot;</span>
          <span className="text-chrono-text-muted tabular-nums">
            <span className="text-chrono-text-secondary">{String(nodesLanded).padStart(2, "0")}</span>
            <span className="text-chrono-border/70"> / </span>
            <span>{DEMO_NODES.length}</span> nodes
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="relative" style={{ height: CARD_H - 40, opacity: masterFade }}>
        {/* Ambient glow */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[220px] w-[600px] rounded-full bg-chrono-accent/[0.04] blur-[80px]" />
        </div>

        {/* Grid lines */}
        <div className="absolute inset-0 grid-lines opacity-30" />

        {/* Query pill */}
        <div
          className="absolute top-4 left-4 flex items-center gap-2 rounded-lg border bg-chrono-bg/70 backdrop-blur-sm px-3 py-1.5 z-20"
          style={{
            borderColor: submitFlash ? "#d4a050" : "rgba(82,82,91,0.7)",
            boxShadow: submitFlash ? "0 0 22px rgba(212,160,80,0.4)" : "none",
            transition: "border-color 120ms, box-shadow 120ms",
          }}
        >
          <Icon name="search" size={12} />
          <span className="text-chrono-caption font-mono text-chrono-text">
            {queryText}
            {t < 1.8 && <span className="inline-block w-[1.5px] h-[12px] bg-chrono-accent align-[-1px] ml-[1px] caret" />}
          </span>
          <span
            className="ml-2 text-[10px] font-medium px-1.5 py-0.5 rounded bg-chrono-accent/15 text-chrono-accent"
            style={{ opacity: queryText.length === QUERY.length ? 1 : 0.25, transition: "opacity 200ms" }}
          >
            research &rarr;
          </span>
        </div>

        {/* Synthesis pill */}
        <div
          className="absolute bottom-4 right-4 flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-mono z-20"
          style={{
            borderColor: "rgba(212,160,80,0.55)",
            background: "rgba(212,160,80,0.1)",
            color: "#d4a050",
            opacity: synthOpacity,
            boxShadow: synthOpacity > 0.5 ? "0 0 24px rgba(212,160,80,0.3)" : "none",
          }}
        >
          <Icon name="check" size={11} strokeWidth={2.5} />
          <span>Synthesis complete</span>
          <span className="text-chrono-accent/50">&middot;</span>
          <span>{DEMO_NODES.length} nodes</span>
          <span className="text-chrono-accent/50">&middot;</span>
          <span>{DEMO_CONNS.length} links</span>
          <span className="text-chrono-accent/50">&middot;</span>
          <span>31 sources</span>
        </div>

        {/* Scrolling timeline */}
        <div className="absolute inset-0 overflow-hidden">
          <div
            className="relative h-full"
            style={{
              width: CONTENT_W,
              transform: `translateX(${Math.max(-140, Math.min(0, -(t - 2) * 16))}px)`,
              transition: "transform 60ms linear",
            }}
          >
            {/* Horizontal spine */}
            <div
              className="absolute left-0 right-0 h-px"
              style={{
                top: SPINE_Y,
                background: "linear-gradient(to right, transparent, #3f3f46 8%, #3f3f46 92%, transparent)",
                opacity: spineOpacity,
              }}
            />

            {/* Year tick marks */}
            {DEMO_NODES.map((n) => (
              <div
                key={`tick-${n.id}`}
                className="absolute w-px h-2 bg-chrono-border/60"
                style={{ left: n.x, top: SPINE_Y - 4, opacity: spineOpacity }}
              />
            ))}

            {/* Connection arcs */}
            <svg
              className="absolute inset-0 overflow-visible"
              width={CONTENT_W}
              height="100%"
              style={{ pointerEvents: "none" }}
            >
              {DEMO_CONNS.map((c, i) => {
                const a = DEMO_NODES[c.from];
                const b = DEMO_NODES[c.to];
                const x1 = a.x, x2 = b.x;
                const midX = (x1 + x2) / 2;
                const dy = 60;
                const d = `M ${x1} ${SPINE_Y} Q ${midX} ${SPINE_Y - dy} ${x2} ${SPINE_Y}`;
                const color = CONN_COLOR[c.kind];
                const draw = clamp01((t - c.startAt) / 0.75);
                return (
                  <g key={i} style={{ opacity: draw }}>
                    <path
                      d={d}
                      stroke={color}
                      strokeWidth="1.3"
                      fill="none"
                      strokeDasharray="260"
                      strokeDashoffset={260 - draw * 260}
                      opacity="0.75"
                    />
                    {draw > 0.65 && (
                      <text
                        x={midX}
                        y={SPINE_Y - dy - 4}
                        fill={color}
                        fontSize="9"
                        fontFamily="Geist Mono, ui-monospace, monospace"
                        textAnchor="middle"
                        opacity={clamp01((draw - 0.65) / 0.35) * 0.85}
                      >
                        {c.kind}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>

            {/* Nodes + cards */}
            {DEMO_NODES.map((n, i) => {
              const appearT = 2.0 + (i / DEMO_NODES.length) * 0.9;
              const outlineOpacity = clamp01((t - appearT) / 0.25);
              const enrichProgress = clamp01((t - n.enrich) / 0.55);
              const cardReveal = clamp01((t - (n.enrich + 0.15)) / 0.5);
              const titleChars = Math.floor(n.title.length * clamp01((t - (n.enrich + 0.25)) / 0.55));
              const shimmer = t > n.enrich && t < n.enrich + 0.55;

              const dotBg = enrichProgress > 0.3 ? TIER_COLOR[n.tier] : "#09090b";
              const cardW = 180;
              const cardH = 56;
              const cardTop = n.side === +1 ? SPINE_Y - 20 - cardH : SPINE_Y + 20;

              return (
                <Fragment key={n.id}>
                  {/* Connector stub */}
                  <div
                    className="absolute w-px"
                    style={{
                      left: n.x,
                      top: n.side === +1 ? cardTop + cardH : SPINE_Y,
                      height: 20,
                      background: TIER_COLOR[n.tier],
                      opacity: outlineOpacity * 0.4,
                    }}
                  />

                  {/* Year label */}
                  <div
                    className="absolute font-mono text-[10px] text-chrono-text-muted/80"
                    style={{
                      left: n.x + 6,
                      top: SPINE_Y + (n.side === +1 ? 4 : -16),
                      opacity: outlineOpacity,
                    }}
                  >
                    {n.year}
                  </div>

                  {/* Dot */}
                  <div
                    className="absolute rounded-full"
                    style={{
                      left: n.x - 5,
                      top: SPINE_Y - 5,
                      width: 10,
                      height: 10,
                      background: dotBg,
                      border: `1.5px solid ${TIER_COLOR[n.tier]}`,
                      boxShadow: shimmer ? `0 0 12px 2px ${TIER_COLOR[n.tier]}66` : "none",
                      opacity: outlineOpacity,
                      transition: "background 300ms, box-shadow 300ms",
                      zIndex: 2,
                    }}
                  />

                  {/* Card */}
                  <div
                    className="absolute rounded-lg overflow-hidden"
                    style={{
                      left: n.x - cardW / 2,
                      top: cardTop,
                      width: cardW,
                      height: cardH,
                      padding: 9,
                      background: "rgba(24,24,27,0.85)",
                      backdropFilter: "blur(2px)",
                      border: "1px solid rgba(82,82,91,0.5)",
                      borderTop: n.side === -1 ? `${n.tier === "revolutionary" ? 2 : 1}px solid ${TIER_COLOR[n.tier]}` : "1px solid rgba(82,82,91,0.5)",
                      borderBottom: n.side === +1 ? `${n.tier === "revolutionary" ? 2 : 1}px solid ${TIER_COLOR[n.tier]}` : "1px solid rgba(82,82,91,0.5)",
                      opacity: outlineOpacity * (0.4 + cardReveal * 0.6),
                      transform: `translateY(${(1 - outlineOpacity) * (n.side === +1 ? -4 : 4)}px)`,
                      transition: "opacity 240ms",
                    }}
                  >
                    <div
                      className="text-[11px] font-medium text-chrono-text leading-tight truncate"
                      style={{ opacity: 0.35 + cardReveal * 0.65 }}
                    >
                      {n.title.slice(0, titleChars)}
                      {cardReveal > 0.1 && cardReveal < 0.95 && (
                        <span className="inline-block w-[1px] h-[9px] bg-chrono-accent align-[-1px] ml-[1px] caret" />
                      )}
                    </div>
                    <div
                      className="mt-1.5 flex items-center gap-1.5"
                      style={{ opacity: clamp01((cardReveal - 0.6) / 0.4) }}
                    >
                      <span className="font-mono text-[9px] text-chrono-text-muted">{n.year}</span>
                      <span className="text-chrono-border">&middot;</span>
                      <span className="font-mono text-[9px]" style={{ color: TIER_COLOR[n.tier], opacity: 0.9 }}>
                        {n.tier === "revolutionary" ? "★" : n.tier === "high" ? "◆" : "•"} {n.tier}
                      </span>
                      <span className="ml-auto font-mono text-[9px] text-chrono-text-muted/60">{n.agent}</span>
                    </div>
                    {shimmer && (
                      <div
                        className="absolute inset-0 pointer-events-none"
                        style={{
                          background: "linear-gradient(110deg, transparent 30%, rgba(212,160,80,0.2) 50%, transparent 70%)",
                          backgroundSize: "200% 100%",
                          animation: "shimmerBar 0.7s linear",
                        }}
                      />
                    )}
                  </div>
                </Fragment>
              );
            })}
          </div>
        </div>

        {/* Edge fades */}
        <div className="pointer-events-none absolute top-0 right-0 h-full w-24 bg-gradient-to-l from-chrono-surface/80 to-transparent" />
        <div className="pointer-events-none absolute top-0 left-0 h-full w-10 bg-gradient-to-r from-chrono-surface/60 to-transparent" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  HeroSearch                                                         */
/* ------------------------------------------------------------------ */

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

  const placeholder = isZh
    ? `试试 "${HERO_SUGGESTIONS[placeholderIdx]}"…`
    : `Try "${HERO_SUGGESTIONS[placeholderIdx]}"…`;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = q.trim();
    if (!trimmed) return;
    router.push(`/app/session/new?topic=${encodeURIComponent(trimmed)}`);
  };

  return (
    <form onSubmit={submit} className={`relative w-full max-w-xl mx-auto transition-all ${focus ? "scale-[1.005]" : ""}`}>
      <div
        className={`relative flex items-center bg-chrono-surface/80 backdrop-blur-md border rounded-xl transition-colors ${
          focus ? "border-chrono-accent/60 shadow-lg shadow-chrono-accent/10" : "border-chrono-border/70"
        }`}
      >
        <span className="pl-5 text-chrono-text-muted">
          <Icon name="search" size={18} />
        </span>
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          placeholder={placeholder}
          className="flex-1 bg-transparent pl-3 pr-3 py-4 text-chrono-subtitle text-chrono-text placeholder:text-chrono-text-muted/70 outline-none"
        />
        <div className="mr-2 flex items-center gap-2">
          <span className="hidden sm:inline text-chrono-tiny text-chrono-text-muted/70 font-mono px-2 py-1 rounded border border-chrono-border/50">
            ⌘ K
          </span>
          <button
            type="submit"
            disabled={!q.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-chrono-accent px-4 py-2 text-chrono-caption font-medium text-chrono-bg hover:bg-chrono-accent/90 disabled:opacity-50 transition-opacity cursor-pointer"
          >
            {isZh ? "调研" : "Research"} <Icon name="arrowRight" size={14} strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* Complexity hint */}
      <div className="mt-3 flex items-center justify-center gap-2 text-chrono-tiny text-chrono-text-muted">
        <span className="inline-flex items-center gap-1"><span className="size-1.5 rounded-full bg-chrono-level-light" />light &middot; 15–25</span>
        <span className="text-chrono-border">&middot;</span>
        <span className="inline-flex items-center gap-1"><span className="size-1.5 rounded-full bg-chrono-level-medium" />medium &middot; 25–45</span>
        <span className="text-chrono-border">&middot;</span>
        <span className="inline-flex items-center gap-1"><span className="size-1.5 rounded-full bg-chrono-level-deep" />deep &middot; 50–80</span>
        <span className="text-chrono-border">&middot;</span>
        <span className="inline-flex items-center gap-1"><span className="size-1.5 rounded-full bg-chrono-level-epic" />epic &middot; 80–150+</span>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/*  Hero                                                               */
/* ------------------------------------------------------------------ */

interface Props {
  locale: Locale;
}

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

      {/* BAND 1: clean hero text + search */}
      <div className="relative mx-auto max-w-5xl px-8 pt-28 pb-12 text-center">
        {/* Eyebrow */}
        <div className="inline-flex items-center gap-2 rounded-full border border-chrono-border/60 bg-chrono-surface/40 backdrop-blur-sm pl-1 pr-3 py-1 text-chrono-tiny">
          <span className="inline-flex items-center gap-1 rounded-full bg-chrono-accent/10 text-chrono-accent px-2 py-0.5 font-medium">
            <span className="size-1.5 rounded-full bg-chrono-accent animate-pulse" />
            New
          </span>
          <span className="text-chrono-text-secondary">
            {isZh ? "多智能体调研 · 流式时间线" : "Multi-agent research · streaming timelines"}
          </span>
          <span className="text-chrono-text-muted"> &rarr; </span>
          <span className="text-chrono-accent/80">
            {isZh ? "阅读发布说明" : "Read the launch note"}
          </span>
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

        {/* Trust row */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-chrono-tiny text-chrono-text-muted">
          <div className="inline-flex items-center gap-2">
            <Icon name="sparkles" size={13} />
            <span>
              Powered by{" "}
              <span className="font-mono text-chrono-text-secondary">deepseek-v3.2</span> &middot;{" "}
              <span className="font-mono text-chrono-text-secondary">gpt-4.1</span> &middot;{" "}
              <span className="font-mono text-chrono-text-secondary">claude-sonnet-4.5</span>
            </span>
          </div>
          <span className="text-chrono-border hidden sm:inline">&middot;</span>
          <div className="inline-flex items-center gap-2">
            <Icon name="check" size={13} />
            <span>{isZh ? "每个节点链接到原始来源" : "Every node links back to primary sources"}</span>
          </div>
          <span className="text-chrono-border hidden sm:inline">&middot;</span>
          <div className="inline-flex items-center gap-2">
            <Icon name="globe" size={13} />
            <span>English &middot; 简体中文</span>
          </div>
        </div>
      </div>

      {/* BAND 2: theater */}
      <div className="relative mx-auto max-w-6xl px-8 pb-24">
        <div className="mb-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="text-chrono-tiny font-medium uppercase tracking-[0.05em] text-chrono-accent/80 inline-flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-chrono-accent animate-pulse" />
            {isZh ? "观看时间线自动构建" : "Watch a timeline build itself"}
          </div>
          <span className="font-mono text-chrono-tiny text-chrono-text-muted">
            query: <span className="text-chrono-text-secondary">Renaissance</span> &middot; replaying at 10&times;
          </span>
        </div>
        <TimelineTheater />
        <p className="mt-4 text-chrono-caption text-chrono-text-muted text-center max-w-2xl mx-auto">
          {isZh
            ? "节点随着智能体完成而流式出现。重要性层级、年份锚点和因果关联并行解析 — 实际运行约需 2–8 分钟。"
            : "Nodes stream in as agents finish them. Significance tiers, year anchors, and causal links resolve in parallel — the real thing runs in ~2–8 minutes depending on depth."}
        </p>
      </div>
    </section>
  );
}
