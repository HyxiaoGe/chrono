"use client";

import type { Locale } from "@/data/landing";

interface Props {
  locale: Locale;
}

interface RecentCard {
  category: string;
  categoryZh: string;
  level: "light" | "medium" | "deep" | "epic";
  title: string;
  titleZh: string;
  years: string;
  dots: { pos: number; color: string }[];
  nodes: number;
  sources: number;
  connections: number;
  elapsed: string;
}

const LEVEL_COLORS: Record<string, string> = {
  light: "text-chrono-level-light",
  medium: "text-chrono-level-medium",
  deep: "text-chrono-level-deep",
  epic: "text-chrono-level-epic",
};

const RECENT: RecentCard[] = [
  {
    category: "Technology",
    categoryZh: "科技",
    level: "deep",
    title: "History of iPhone",
    titleZh: "iPhone 发展史",
    years: "2004 – 2024",
    dots: [
      { pos: 5, color: "#f0c060" },
      { pos: 20, color: "#8a9ab0" },
      { pos: 35, color: "#f0c060" },
      { pos: 50, color: "#71717a" },
      { pos: 65, color: "#8a9ab0" },
      { pos: 80, color: "#f0c060" },
      { pos: 95, color: "#8a9ab0" },
    ],
    nodes: 62,
    sources: 124,
    connections: 18,
    elapsed: "4m 32s",
  },
  {
    category: "History",
    categoryZh: "历史",
    level: "epic",
    title: "Cold War Timeline",
    titleZh: "冷战时间线",
    years: "1947 – 1991",
    dots: [
      { pos: 8, color: "#f0c060" },
      { pos: 22, color: "#f0c060" },
      { pos: 38, color: "#8a9ab0" },
      { pos: 52, color: "#71717a" },
      { pos: 68, color: "#f0c060" },
      { pos: 82, color: "#8a9ab0" },
      { pos: 92, color: "#f0c060" },
    ],
    nodes: 120,
    sources: 240,
    connections: 35,
    elapsed: "12m 15s",
  },
  {
    category: "Science",
    categoryZh: "科学",
    level: "medium",
    title: "CRISPR Gene Editing",
    titleZh: "CRISPR 基因编辑",
    years: "2012 – 2024",
    dots: [
      { pos: 10, color: "#f0c060" },
      { pos: 30, color: "#8a9ab0" },
      { pos: 55, color: "#f0c060" },
      { pos: 75, color: "#71717a" },
      { pos: 90, color: "#8a9ab0" },
    ],
    nodes: 30,
    sources: 58,
    connections: 8,
    elapsed: "2m 10s",
  },
  {
    category: "Culture",
    categoryZh: "文化",
    level: "deep",
    title: "Evolution of Hip Hop",
    titleZh: "嘻哈音乐演变",
    years: "1973 – 2024",
    dots: [
      { pos: 5, color: "#f0c060" },
      { pos: 18, color: "#8a9ab0" },
      { pos: 32, color: "#71717a" },
      { pos: 48, color: "#f0c060" },
      { pos: 62, color: "#8a9ab0" },
      { pos: 78, color: "#f0c060" },
      { pos: 92, color: "#71717a" },
    ],
    nodes: 55,
    sources: 98,
    connections: 14,
    elapsed: "3m 45s",
  },
];

function MiniTimeline({ dots }: { dots: RecentCard["dots"] }) {
  return (
    <div className="relative h-4 my-3">
      <div className="absolute top-1/2 left-0 right-0 h-px bg-chrono-border/30 -translate-y-1/2" />
      {dots.map((d, i) => (
        <div
          key={i}
          className="absolute top-1/2 -translate-y-1/2 size-2 rounded-full"
          style={{ left: `${d.pos}%`, backgroundColor: d.color }}
        />
      ))}
    </div>
  );
}

export function RecentResearches({ locale }: Props) {
  const isZh = locale === "zh";

  return (
    <section id="recent" className="py-24 sm:py-32 px-4">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="text-center mb-12">
          <span className="text-chrono-tiny font-medium text-chrono-accent/70 uppercase tracking-wider">
            {isZh ? "最近的调研" : "Recently researched"}
          </span>
          <h2 className="mt-2 text-3xl sm:text-4xl font-bold text-chrono-text">
            {isZh ? "来自社区的时间线" : "From the community timeline"}
          </h2>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {RECENT.map((card) => (
            <div
              key={card.title}
              className="rounded-xl border border-chrono-border/40 bg-chrono-surface/20 p-5 hover:border-chrono-border/60 hover:bg-chrono-surface/30 transition-colors"
            >
              {/* Category + level */}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-chrono-tiny text-chrono-text-muted">
                  {isZh ? card.categoryZh : card.category}
                </span>
                <span className={`text-chrono-tiny font-medium ${LEVEL_COLORS[card.level]}`}>
                  {card.level}
                </span>
              </div>

              {/* Title */}
              <h3 className="text-chrono-body font-semibold text-chrono-text">
                {isZh ? card.titleZh : card.title}
              </h3>

              {/* Year span */}
              <span className="text-chrono-tiny text-chrono-text-muted">{card.years}</span>

              {/* Mini timeline */}
              <MiniTimeline dots={card.dots} />

              {/* Footer meta */}
              <div className="flex items-center gap-3 text-chrono-tiny text-chrono-text-muted mt-1">
                <span>{card.nodes} nodes</span>
                <span>{card.sources} sources</span>
                <span>{card.connections} links</span>
                <span className="ml-auto">{card.elapsed}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
