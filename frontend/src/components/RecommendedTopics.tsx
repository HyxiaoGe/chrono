"use client";

import { useEffect, useState } from "react";
import { Cpu, Landmark, Globe, Atom, type LucideIcon } from "lucide-react";
import type { Locale } from "@/data/landing";
import { messages } from "@/data/landing";

interface Topic {
  title: Record<string, string>;
  subtitle: Record<string, string>;
  complexity: string;
  estimated_nodes: number;
  cached?: boolean;
}

interface Category {
  id: string;
  icon: string;
  label: Record<string, string>;
  topics: Topic[];
}

interface Props {
  onSelectTopic: (topic: string) => void;
  locale: Locale;
  disabled?: boolean;
}

const ICON_MAP: Record<string, LucideIcon> = {
  cpu: Cpu,
  landmark: Landmark,
  globe: Globe,
  atom: Atom,
};

const BADGE_COLORS: Record<string, string> = {
  light: "bg-chrono-level-light/15 text-chrono-level-light",
  medium: "bg-chrono-level-medium/15 text-chrono-level-medium",
  deep: "bg-chrono-level-deep/15 text-chrono-level-deep",
  epic: "bg-chrono-level-epic/15 text-chrono-level-epic",
};

const LEVEL_LABELS: Record<string, Record<Locale, string>> = {
  light: { en: "Light", zh: "轻量" },
  medium: { en: "Medium", zh: "中等" },
  deep: { en: "Deep", zh: "深度" },
  epic: { en: "Epic", zh: "史诗" },
};

const LEVEL_BORDER: Record<string, string> = {
  light: "border-l-chrono-level-light",
  medium: "border-l-chrono-level-medium",
  deep: "border-l-chrono-level-deep",
  epic: "border-l-chrono-level-epic",
};

export function RecommendedTopics({ onSelectTopic, locale, disabled }: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const t = messages[locale].app;

  useEffect(() => {
    fetch("/api/topics/recommended")
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data: Category[]) => {
        setCategories(data);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="mt-8 w-full max-w-4xl">
        <div className="text-chrono-caption text-chrono-text-muted mb-4 tracking-wide uppercase">
          {t.explore}
        </div>
        <div className="flex gap-2 mb-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="shimmer h-7 w-20 rounded-full" />
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="rounded-lg border border-chrono-border/40 px-4 py-3 space-y-2">
              <div className="shimmer h-4 w-24 rounded" />
              <div className="shimmer h-3 w-full rounded" />
              <div className="flex gap-2">
                <div className="shimmer h-4 w-14 rounded-full" />
                <div className="shimmer h-3 w-16 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (categories.length === 0) return null;

  const active = categories[activeTab];

  return (
    <div className="mt-8 w-full max-w-4xl">
      <h2 className="text-chrono-caption text-chrono-text-muted mb-4 tracking-wide uppercase">
        {t.explore}
      </h2>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {categories.map((cat, i) => {
          const Icon = ICON_MAP[cat.icon];
          const isActive = i === activeTab;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveTab(i)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-chrono-caption cursor-pointer transition-colors whitespace-nowrap
                ${isActive
                  ? "bg-chrono-accent/10 border-chrono-accent text-chrono-accent"
                  : "border-chrono-border/50 text-chrono-text-muted hover:border-chrono-accent/50"
                }`}
            >
              {Icon && <Icon size={14} />}
              {cat.label[locale]}
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-4">
        {active.topics.map((topic) => (
          <button
            key={topic.title[locale]}
            onClick={() => {
              if (disabled) return;
              onSelectTopic(topic.title[locale]);
            }}
            className={`rounded-lg border border-l-[3px] border-chrono-border/40 px-4 py-3 text-left
                       transition-all duration-200
                       ${LEVEL_BORDER[topic.complexity] || ""}
                       ${disabled
                         ? "opacity-50 cursor-not-allowed"
                         : "cursor-pointer hover:border-chrono-accent/60 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-chrono-accent/5"
                       }`}
          >
            <div className="flex items-center text-chrono-body text-chrono-text font-medium">
              <span className="truncate">{topic.title[locale]}</span>
              {topic.cached && (
                <span className="ml-auto text-chrono-tiny text-chrono-accent/70">⚡</span>
              )}
            </div>
            <p className="mt-1 text-chrono-tiny text-chrono-text-muted line-clamp-2">
              {topic.subtitle[locale]}
            </p>
            <div className="mt-3 flex items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-chrono-tiny font-medium
                  ${BADGE_COLORS[topic.complexity] || ""}`}
              >
                {LEVEL_LABELS[topic.complexity]?.[locale] ?? topic.complexity}
              </span>
              <span className="text-chrono-tiny text-chrono-text-muted/50">
                ~{topic.estimated_nodes} {locale === "zh" ? "节点" : "nodes"}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
