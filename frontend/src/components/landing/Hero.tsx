"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/data/landing";
import { Icon } from "@/components/ui/Icon";

interface Props {
  locale: Locale;
}

const PLACEHOLDERS = [
  "iPhone",
  "Cold War",
  "Bitcoin",
  "Roman Empire",
  "Quantum Mechanics",
  "World Wide Web",
  "Space Race",
  "CRISPR",
];

const CYCLE_MS = 2800;
const LOOP_DURATION = 12; // seconds

/* ---------- Demo node & arc data ---------- */
interface DemoNode {
  id: number;
  x: number;
  side: number;
  year: string;
  tier: "revolutionary" | "high" | "medium";
  title: string;
  enrich: number;
  agent: string;
}

interface DemoArc {
  from: number;
  to: number;
  kind: "inspired" | "enabled" | "responded";
  startAt: number;
}

const NODES: DemoNode[] = [
  { id: 0, x: 60, side: +1, year: "1401", tier: "revolutionary", title: "Ghiberti's Baptistery Doors", enrich: 3.2, agent: "Milestone" },
  { id: 1, x: 180, side: -1, year: "1436", tier: "high", title: "Brunelleschi · Duomo", enrich: 4.1, agent: "Detail" },
  { id: 2, x: 300, side: +1, year: "1450", tier: "high", title: "Gutenberg press", enrich: 3.8, agent: "Milestone" },
  { id: 3, x: 430, side: -1, year: "1492", tier: "revolutionary", title: "Columbus · New World", enrich: 5.4, agent: "Detail" },
  { id: 4, x: 560, side: +1, year: "1503", tier: "medium", title: "Mona Lisa begun", enrich: 6.3, agent: "Gap" },
  { id: 5, x: 680, side: -1, year: "1517", tier: "revolutionary", title: "Luther · 95 Theses", enrich: 4.8, agent: "Milestone" },
  { id: 6, x: 800, side: +1, year: "1543", tier: "high", title: "Copernicus · heliocentrism", enrich: 5.9, agent: "Detail" },
  { id: 7, x: 920, side: -1, year: "1599", tier: "medium", title: "Globe Theatre opens", enrich: 7.1, agent: "Gap" },
];

const ARCS: DemoArc[] = [
  { from: 0, to: 2, kind: "inspired", startAt: 8.1 },
  { from: 2, to: 5, kind: "enabled", startAt: 8.5 },
  { from: 3, to: 6, kind: "inspired", startAt: 9.0 },
  { from: 5, to: 7, kind: "responded", startAt: 9.4 },
];

const TIER_COLORS: Record<string, string> = {
  revolutionary: "#f0c060",
  high: "#8a9ab0",
  medium: "#71717a",
};

const ARC_COLORS: Record<string, string> = {
  caused: "#e07050",
  enabled: "#5090d0",
  inspired: "#50b080",
  responded: "#9070c0",
};

/* ---------- HeroSearch ---------- */
function HeroSearch({ locale }: { locale: Locale }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [phIdx, setPhIdx] = useState(0);
  const [displayed, setDisplayed] = useState("");
  const [typing, setTyping] = useState(true);
  const isZh = locale === "zh";

  // cycle through placeholders
  useEffect(() => {
    const target = PLACEHOLDERS[phIdx];
    if (typing) {
      if (displayed.length < target.length) {
        const t = setTimeout(() => setDisplayed(target.slice(0, displayed.length + 1)), 80);
        return () => clearTimeout(t);
      }
      // pause then erase
      const t = setTimeout(() => setTyping(false), CYCLE_MS);
      return () => clearTimeout(t);
    }
    // erasing
    if (displayed.length > 0) {
      const t = setTimeout(() => setDisplayed(displayed.slice(0, -1)), 40);
      return () => clearTimeout(t);
    }
    // next word
    setPhIdx((phIdx + 1) % PLACEHOLDERS.length);
    setTyping(true);
  }, [displayed, typing, phIdx]);

  const submit = () => {
    const q = query.trim();
    if (!q) return;
    router.push(`/app/session/new?topic=${encodeURIComponent(q)}`);
  };

  return (
    <div className="relative mx-auto mt-8 max-w-xl">
      <div className="flex items-center rounded-xl border border-chrono-border/60 bg-chrono-surface/40 focus-within:border-chrono-accent/50 transition-colors">
        <Icon name="search" size={18} className="ml-4 text-chrono-text-muted" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder={displayed + (query ? "" : "|")}
          className="flex-1 bg-transparent px-3 py-3.5 text-chrono-body text-chrono-text placeholder:text-chrono-text-muted/50 outline-none"
        />
        <kbd className="hidden sm:inline-flex items-center mr-2 px-1.5 py-0.5 rounded text-chrono-tiny text-chrono-text-muted border border-chrono-border/40 bg-chrono-bg/50">
          ⌘K
        </kbd>
        <button
          onClick={submit}
          className="mr-1.5 rounded-lg bg-chrono-accent px-4 py-2 text-chrono-caption font-medium text-chrono-bg hover:bg-chrono-accent/90 transition-colors cursor-pointer"
        >
          {isZh ? "调研 →" : "Research →"}
        </button>
      </div>
    </div>
  );
}

/* ---------- TimelineTheater ---------- */
function TimelineTheater({ locale }: { locale: Locale }) {
  const isZh = locale === "zh";
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number>(0);

  const animate = useCallback((timestamp: number) => {
    if (startRef.current === null) startRef.current = timestamp;
    const t = ((timestamp - startRef.current) / 1000) % LOOP_DURATION;
    setElapsed(t);

    const canvas = canvasRef.current;
    if (!canvas) {
      rafRef.current = requestAnimationFrame(animate);
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      rafRef.current = requestAnimationFrame(animate);
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const scaleX = w / 1000;
    const spineY = h * 0.5;

    // spine line
    ctx.strokeStyle = "rgba(63,63,70,0.5)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(20, spineY);
    ctx.lineTo(w - 20, spineY);
    ctx.stroke();

    // nodes
    for (const node of NODES) {
      const nx = node.x * scaleX;
      const nodeAppearAt = 2 + node.id * 0.12;
      const enrichAt = 3 + node.enrich * 0.5;
      const progress = Math.max(0, Math.min(1, (t - nodeAppearAt) / 0.4));
      if (progress <= 0) continue;

      const offsetY = node.side * 60;
      const ny = spineY + offsetY;
      const color = TIER_COLORS[node.tier];

      // stem
      ctx.globalAlpha = progress;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(nx, spineY);
      ctx.lineTo(nx, ny);
      ctx.stroke();

      // dot on spine
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(nx, spineY, 3 * progress, 0, Math.PI * 2);
      ctx.fill();

      // node card bg
      const cardW = 110;
      const cardH = 40;
      const cardX = nx - cardW / 2;
      const cardY = node.side > 0 ? ny - cardH - 6 : ny + 6;

      ctx.fillStyle = "rgba(24,24,27,0.9)";
      ctx.strokeStyle = `${color}44`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, cardW, cardH, 6);
      ctx.fill();
      ctx.stroke();

      // year
      ctx.fillStyle = color;
      ctx.font = "bold 10px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(node.year, cardX + 6, cardY + 14);

      // title - only after enrichment starts
      const enrichProgress = Math.max(0, Math.min(1, (t - enrichAt) / 1.2));
      if (enrichProgress > 0) {
        ctx.fillStyle = "rgba(250,250,250,0.8)";
        ctx.font = "9px system-ui, sans-serif";
        const chars = Math.floor(enrichProgress * node.title.length);
        ctx.fillText(node.title.slice(0, chars), cardX + 6, cardY + 28);
      }

      ctx.globalAlpha = 1;
    }

    // arcs
    for (const arc of ARCS) {
      const arcProgress = Math.max(0, Math.min(1, (t - arc.startAt) / 0.8));
      if (arcProgress <= 0) continue;

      const fromNode = NODES[arc.from];
      const toNode = NODES[arc.to];
      const x1 = fromNode.x * scaleX;
      const x2 = toNode.x * scaleX;
      const cpY = spineY - 100;

      ctx.globalAlpha = arcProgress * 0.6;
      ctx.strokeStyle = ARC_COLORS[arc.kind];
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(x1, spineY);
      const cpX = (x1 + x2) / 2;
      ctx.quadraticCurveTo(cpX, cpY, x2 * arcProgress + x1 * (1 - arcProgress), spineY + (spineY - cpY) * (1 - arcProgress));
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }

    // synthesis pill
    if (t > 10) {
      const synthProgress = Math.min(1, (t - 10) / 0.6);
      ctx.globalAlpha = synthProgress;
      const pillW = 140;
      const pillH = 26;
      const pillX = w / 2 - pillW / 2;
      const pillY = h - 40;
      ctx.fillStyle = "rgba(212,160,80,0.12)";
      ctx.strokeStyle = "rgba(212,160,80,0.3)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(pillX, pillY, pillW, pillH, 13);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "rgba(212,160,80,0.9)";
      ctx.font = "10px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(isZh ? "✦ 综合分析完成" : "✦ Synthesis complete", w / 2, pillY + 16);
      ctx.globalAlpha = 1;
    }

    rafRef.current = requestAnimationFrame(animate);
  }, [isZh]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [animate]);

  const visibleNodes = NODES.filter((_, i) => elapsed > 2 + i * 0.12).length;
  const agentName = elapsed < 2
    ? "Orchestrator"
    : elapsed < 8
      ? `Detail-${Math.min(visibleNodes, 8)}`
      : elapsed < 10
        ? "Connection"
        : "Synthesizer";

  return (
    <div className="mx-auto mt-16 max-w-5xl">
      <div className="text-center mb-4">
        <span className="text-chrono-caption text-chrono-text-muted">
          {isZh ? "观看时间线自动构建" : "Watch a timeline build itself"}
        </span>
        <span className="mx-2 text-chrono-border">·</span>
        <span className="text-chrono-tiny text-chrono-text-muted">
          {isZh ? "查询: 文艺复兴 · 10× 回放" : "query: Renaissance · replaying at 10×"}
        </span>
      </div>
      <div className="rounded-xl border border-chrono-border/40 bg-chrono-surface/20 overflow-hidden">
        {/* Chrome bar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-chrono-border/30 bg-chrono-bg/60">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <span className="size-2.5 rounded-full bg-chrono-border/60" />
              <span className="size-2.5 rounded-full bg-chrono-border/60" />
              <span className="size-2.5 rounded-full bg-chrono-border/60" />
            </div>
            <span className="ml-2 text-chrono-tiny text-chrono-accent/80 font-medium flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-green-500 animate-pulse" />
              Live session
            </span>
          </div>
          <div className="flex items-center gap-4 text-chrono-tiny text-chrono-text-muted">
            <span className="font-mono">{agentName}</span>
            <span>{elapsed.toFixed(1)}s</span>
            <span>{visibleNodes} nodes</span>
          </div>
        </div>
        {/* Canvas */}
        <div className="relative" style={{ height: 360 }}>
          {/* typing query overlay */}
          {elapsed < 2 && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <div className="rounded-lg border border-chrono-border/40 bg-chrono-surface/60 px-6 py-3 flex items-center gap-2">
                <Icon name="search" size={16} className="text-chrono-text-muted" />
                <span className="text-chrono-body text-chrono-text">
                  {"Renaissance".slice(0, Math.floor(elapsed * 6))}
                </span>
                <span className="caret text-chrono-accent">|</span>
              </div>
            </div>
          )}
          <canvas
            ref={canvasRef}
            className="w-full h-full"
            style={{ display: "block" }}
          />
        </div>
      </div>
    </div>
  );
}

/* ---------- Hero Main ---------- */
export function Hero({ locale }: Props) {
  const isZh = locale === "zh";

  return (
    <section className="relative pt-20 sm:pt-28 pb-8 px-4 overflow-hidden">
      {/* Ambient glows */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 h-[600px] w-[800px] rounded-full bg-chrono-accent/[0.04] blur-[120px]" />
        <div className="absolute top-[10%] left-[20%] h-[300px] w-[300px] rounded-full bg-chrono-accent/[0.03] blur-[80px]" />
      </div>

      {/* Band 1: Text + Search */}
      <div className="relative mx-auto max-w-3xl text-center">
        {/* Eyebrow pill */}
        <div className="inline-flex items-center gap-2 rounded-full border border-chrono-accent/20 bg-chrono-accent/[0.06] px-3 py-1 mb-6">
          <span className="rounded-full bg-chrono-accent px-1.5 py-0.5 text-[10px] font-bold text-chrono-bg leading-none">
            New
          </span>
          <span className="text-chrono-tiny text-chrono-text-secondary">
            {isZh
              ? "多智能体调研 · 流式时间线 → 阅读发布说明"
              : "Multi-agent research · streaming timelines → Read the launch note"}
          </span>
        </div>

        {/* Headline */}
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-chrono-text leading-tight">
          {isZh ? "将任何主题转化为" : "Turn any topic into"}
        </h1>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-chrono-accent leading-tight mt-1">
          {isZh ? "一条交互式时间线" : "an interactive timeline"}
        </h1>

        {/* Subtitle */}
        <p className="mt-6 text-chrono-body text-chrono-text-secondary max-w-2xl mx-auto">
          {isZh
            ? "输入任意主题，AI 智能体并行调研，生成有来源引证、事件关联与智能综述的交互式时间线。"
            : "Enter any topic — AI agents research in parallel, building an interactive timeline with sourced events, causal connections, and synthesis."}
        </p>

        {/* Search */}
        <HeroSearch locale={locale} />

        {/* Complexity hint */}
        <div className="mt-4 flex items-center justify-center gap-4 text-chrono-tiny text-chrono-text-muted">
          <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-chrono-level-light" /> {isZh ? "轻量" : "light"} 15-25</span>
          <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-chrono-level-medium" /> {isZh ? "中等" : "medium"} 25-45</span>
          <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-chrono-level-deep" /> {isZh ? "深度" : "deep"} 50-80</span>
          <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-chrono-level-epic" /> {isZh ? "史诗" : "epic"} 80-150+</span>
        </div>

        {/* Trust row */}
        <div className="mt-3 flex flex-col items-center gap-1.5 text-chrono-tiny text-chrono-text-muted/70">
          <span>Powered by deepseek-v3.2 · gpt-4.1 · claude-sonnet-4.5</span>
          <span>
            {isZh
              ? "每个节点链接到来源 · English · 简体中文"
              : "Every node links to sources · English · 简体中文"}
          </span>
        </div>
      </div>

      {/* Band 2: Theater */}
      <TimelineTheater locale={locale} />
    </section>
  );
}
