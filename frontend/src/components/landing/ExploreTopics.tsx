"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/data/landing";
import { Icon } from "@/components/ui/Icon";

interface Props {
  locale: Locale;
}

interface TopicCard {
  title: string;
  titleZh: string;
  subtitle: string;
  subtitleZh: string;
  level: "light" | "medium" | "deep" | "epic";
  nodes: string;
  years: string;
  cached?: boolean;
}

interface Category {
  key: string;
  icon: string;
  label: string;
  labelZh: string;
  topics: TopicCard[];
}

const LEVEL_COLORS: Record<string, string> = {
  light: "border-chrono-level-light text-chrono-level-light",
  medium: "border-chrono-level-medium text-chrono-level-medium",
  deep: "border-chrono-level-deep text-chrono-level-deep",
  epic: "border-chrono-level-epic text-chrono-level-epic",
};

const LEVEL_LEFT_BORDER: Record<string, string> = {
  light: "border-l-[var(--color-chrono-level-light)]",
  medium: "border-l-[var(--color-chrono-level-medium)]",
  deep: "border-l-[var(--color-chrono-level-deep)]",
  epic: "border-l-[var(--color-chrono-level-epic)]",
};

const CATEGORIES: Category[] = [
  {
    key: "technology",
    icon: "cpu",
    label: "Technology",
    labelZh: "科技",
    topics: [
      { title: "iPhone", titleZh: "iPhone", subtitle: "From concept to cultural icon", subtitleZh: "从概念到文化符号", level: "deep", nodes: "62", years: "2004-2024", cached: true },
      { title: "Bitcoin", titleZh: "比特币", subtitle: "Cryptocurrency revolution", subtitleZh: "加密货币革命", level: "epic", nodes: "95", years: "2008-2024" },
      { title: "World Wide Web", titleZh: "万维网", subtitle: "Connecting the world", subtitleZh: "连接全世界", level: "deep", nodes: "55", years: "1989-2024", cached: true },
      { title: "Artificial Intelligence", titleZh: "人工智能", subtitle: "From Turing to transformers", subtitleZh: "从图灵到 Transformer", level: "epic", nodes: "110", years: "1950-2024" },
      { title: "SpaceX", titleZh: "SpaceX", subtitle: "Reusable rockets & beyond", subtitleZh: "可复用火箭", level: "medium", nodes: "38", years: "2002-2024" },
      { title: "Video Games", titleZh: "电子游戏", subtitle: "Pong to photorealism", subtitleZh: "从 Pong 到光追", level: "deep", nodes: "68", years: "1958-2024" },
    ],
  },
  {
    key: "history",
    icon: "landmark",
    label: "History",
    labelZh: "历史",
    topics: [
      { title: "Cold War", titleZh: "冷战", subtitle: "Decades of superpower tension", subtitleZh: "超级大国数十年的对峙", level: "epic", nodes: "120", years: "1947-1991", cached: true },
      { title: "Roman Empire", titleZh: "罗马帝国", subtitle: "Rise and fall", subtitleZh: "兴衰史", level: "epic", nodes: "130", years: "27 BC-476 AD" },
      { title: "Space Race", titleZh: "太空竞赛", subtitle: "US vs USSR to the Moon", subtitleZh: "美苏登月竞赛", level: "deep", nodes: "58", years: "1955-1975" },
      { title: "Silk Road", titleZh: "丝绸之路", subtitle: "Ancient trade networks", subtitleZh: "古代贸易网络", level: "medium", nodes: "35", years: "130 BC-1450" },
      { title: "French Revolution", titleZh: "法国大革命", subtitle: "Liberty, equality, fraternity", subtitleZh: "自由、平等、博爱", level: "deep", nodes: "52", years: "1789-1799" },
      { title: "Industrial Revolution", titleZh: "工业革命", subtitle: "Machines change everything", subtitleZh: "机器改变一切", level: "deep", nodes: "64", years: "1760-1840" },
    ],
  },
  {
    key: "culture",
    icon: "sparkles",
    label: "Culture",
    labelZh: "文化",
    topics: [
      { title: "Hip Hop", titleZh: "嘻哈音乐", subtitle: "From Bronx to global culture", subtitleZh: "从布朗克斯到全球文化", level: "deep", nodes: "55", years: "1973-2024" },
      { title: "Olympic Games", titleZh: "奥林匹克运动会", subtitle: "A modern tradition", subtitleZh: "现代传统", level: "epic", nodes: "88", years: "1896-2024", cached: true },
      { title: "Renaissance Art", titleZh: "文艺复兴艺术", subtitle: "Rebirth of creativity", subtitleZh: "创造力的重生", level: "deep", nodes: "48", years: "1400-1600" },
      { title: "Cinema", titleZh: "电影", subtitle: "Moving pictures evolve", subtitleZh: "活动影像的演变", level: "epic", nodes: "92", years: "1888-2024" },
      { title: "K-Pop", titleZh: "K-Pop", subtitle: "Korean wave worldwide", subtitleZh: "韩流席卷全球", level: "medium", nodes: "32", years: "1992-2024" },
      { title: "Fashion History", titleZh: "时尚史", subtitle: "Style through the ages", subtitleZh: "穿越时代的风格", level: "medium", nodes: "40", years: "1850-2024" },
    ],
  },
  {
    key: "science",
    icon: "atom",
    label: "Science",
    labelZh: "科学",
    topics: [
      { title: "Quantum Mechanics", titleZh: "量子力学", subtitle: "The weird world of the small", subtitleZh: "微观世界的奥秘", level: "deep", nodes: "50", years: "1900-2024" },
      { title: "CRISPR", titleZh: "CRISPR", subtitle: "Gene editing revolution", subtitleZh: "基因编辑革命", level: "medium", nodes: "30", years: "2012-2024", cached: true },
      { title: "Theory of Relativity", titleZh: "相对论", subtitle: "Einstein's masterwork", subtitleZh: "爱因斯坦的杰作", level: "medium", nodes: "28", years: "1905-1979" },
      { title: "DNA Discovery", titleZh: "DNA 发现", subtitle: "Blueprint of life", subtitleZh: "生命的蓝图", level: "deep", nodes: "45", years: "1869-2024" },
      { title: "Climate Science", titleZh: "气候科学", subtitle: "Understanding our planet", subtitleZh: "理解我们的星球", level: "epic", nodes: "78", years: "1824-2024" },
      { title: "Vaccines", titleZh: "疫苗", subtitle: "Conquering disease", subtitleZh: "战胜疾病", level: "deep", nodes: "52", years: "1796-2024" },
    ],
  },
];

export function ExploreTopics({ locale }: Props) {
  const isZh = locale === "zh";
  const [activeTab, setActiveTab] = useState(0);
  const router = useRouter();
  const cat = CATEGORIES[activeTab];

  const handleClick = (title: string) => {
    router.push(`/app/session/new?topic=${encodeURIComponent(title)}`);
  };

  return (
    <section id="explore" className="py-24 sm:py-32 px-4">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="text-center mb-12">
          <span className="text-chrono-tiny font-medium text-chrono-accent/70 uppercase tracking-wider">
            {isZh ? "探索主题" : "Explore topics"}
          </span>
          <h2 className="mt-2 text-3xl sm:text-4xl font-bold text-chrono-text">
            {isZh ? "从精选主题开始" : "Start from a curated topic"}
          </h2>
        </div>

        {/* Tabs */}
        <div className="flex justify-center gap-2 mb-10">
          {CATEGORIES.map((c, i) => (
            <button
              key={c.key}
              onClick={() => setActiveTab(i)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-chrono-caption font-medium transition-colors cursor-pointer ${
                i === activeTab
                  ? "bg-chrono-accent/10 border border-chrono-accent/30 text-chrono-accent"
                  : "border border-chrono-border/30 text-chrono-text-muted hover:text-chrono-text-secondary hover:border-chrono-border/50"
              }`}
            >
              <Icon name={c.icon} size={16} />
              <span>{isZh ? c.labelZh : c.label}</span>
            </button>
          ))}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cat.topics.map((topic) => (
            <button
              key={topic.title}
              onClick={() => handleClick(topic.title)}
              className={`text-left rounded-xl border border-chrono-border/40 bg-chrono-surface/20 p-4 hover:border-chrono-border/70 hover:bg-chrono-surface/40 transition-colors cursor-pointer border-l-2 ${LEVEL_LEFT_BORDER[topic.level]}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-chrono-body font-semibold text-chrono-text">
                  {isZh ? topic.titleZh : topic.title}
                </span>
                {topic.cached && (
                  <span className="rounded-full bg-chrono-accent/10 px-1.5 py-0.5 text-[10px] text-chrono-accent font-medium">
                    cached
                  </span>
                )}
              </div>
              <p className="text-chrono-tiny text-chrono-text-muted mb-3">
                {isZh ? topic.subtitleZh : topic.subtitle}
              </p>
              <div className="flex items-center gap-3 text-chrono-tiny">
                <span className={`rounded-full border px-2 py-0.5 ${LEVEL_COLORS[topic.level]}`}>
                  {topic.level}
                </span>
                <span className="text-chrono-text-muted">{topic.nodes} nodes</span>
                <span className="text-chrono-text-muted">{topic.years}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
