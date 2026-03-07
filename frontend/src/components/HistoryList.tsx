"use client";

import { useEffect, useState } from "react";
import type { ResearchSummary } from "@/types";
import type { Locale } from "@/data/landing";
import { messages } from "@/data/landing";

interface Props {
  onSelectTopic: (topic: string) => void;
  locale: Locale;
  disabled?: boolean;
}

const LEVEL_COLORS: Record<string, string> = {
  light: "border-l-chrono-level-light",
  medium: "border-l-chrono-level-medium",
  deep: "border-l-chrono-level-deep",
  epic: "border-l-chrono-level-epic",
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

function shortSpan(span?: string): string {
  if (!span) return "";
  return span.replace(/\s*[\(（].*?[\)）]\s*/g, "").trim();
}

function formatRelativeTime(isoDate: string, locale: Locale): string {
  const t = messages[locale].app;
  const diff = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (locale === "zh") {
    if (minutes < 1) return "\u521a\u521a";
    if (minutes < 60) return `${minutes}\u5206\u949f${t.ago}`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}\u5c0f\u65f6${t.ago}`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}\u5929${t.ago}`;
    const months = Math.floor(days / 30);
    return `${months}\u4e2a\u6708${t.ago}`;
  }
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ${t.ago}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${t.ago}`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ${t.ago}`;
  const months = Math.floor(days / 30);
  return `${months}mo ${t.ago}`;
}

function groupByType(items: ResearchSummary[]) {
  const tech = items.filter(
    (i) => i.topic_type === "product" || i.topic_type === "technology",
  );
  const history = items.filter(
    (i) => i.topic_type === "historical_event" || i.topic_type === "culture",
  );
  return { tech, history };
}

function HistoryRow({
  item,
  onSelectTopic,
  locale,
  disabled,
}: {
  item: ResearchSummary;
  onSelectTopic: (topic: string) => void;
  locale: Locale;
  disabled?: boolean;
}) {
  const t = messages[locale].app;
  const span = shortSpan(item.timeline_span);

  return (
    <button
      onClick={() => {
        if (disabled) return;
        onSelectTopic(item.topic);
      }}
      className={`group w-full text-left px-4 py-3 border-l-[3px] transition-colors
                  ${LEVEL_COLORS[item.complexity_level] || "border-l-chrono-border"}
                  ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-chrono-surface/80"}`}
    >
      <div className="flex items-center gap-3">
        <span className="text-chrono-body text-chrono-text font-semibold truncate min-w-0 flex-1">
          {item.topic}
        </span>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-chrono-tiny font-medium
                      ${BADGE_COLORS[item.complexity_level] || ""}`}
        >
          {LEVEL_LABELS[item.complexity_level]?.[locale] ?? item.complexity_level}
        </span>
        <span className="shrink-0 text-chrono-tiny text-chrono-text-muted/50">
          {formatRelativeTime(item.created_at, locale)}
        </span>
      </div>

      <p className="mt-1 text-chrono-tiny text-chrono-text-muted">
        {span}
        {span && <> &middot; </>}
        {item.total_nodes} {t.nodes}
        {item.source_count > 0 && <> &middot; {item.source_count} {locale === "zh" ? "来源" : "sources"}</>}
      </p>

      {item.key_insight && (
        <p className="mt-1 text-chrono-tiny text-chrono-text-muted/60 line-clamp-1">
          {item.key_insight}
        </p>
      )}
    </button>
  );
}

function HistoryGroup({
  title,
  items,
  onSelectTopic,
  locale,
  disabled,
}: {
  title: string;
  items: ResearchSummary[];
  onSelectTopic: (topic: string) => void;
  locale: Locale;
  disabled?: boolean;
}) {
  return (
    <div>
      <h2 className="text-chrono-caption text-chrono-text-muted mb-2 tracking-wide uppercase">
        {title}
      </h2>
      <div className="rounded-lg border border-chrono-border/40 overflow-hidden divide-y divide-chrono-border/20">
        {items.map((item) => (
          <HistoryRow
            key={item.id}
            item={item}
            onSelectTopic={onSelectTopic}
            locale={locale}
            disabled={disabled}
          />
        ))}
      </div>
    </div>
  );
}

export function HistoryList({ onSelectTopic, locale, disabled }: Props) {
  const [items, setItems] = useState<ResearchSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const t = messages[locale].app;

  useEffect(() => {
    fetch("/api/researches")
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data: ResearchSummary[]) => {
        setItems(data);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, []);

  if (error) return null;
  if (!loading && items.length === 0) {
    return (
      <div className="w-full max-w-4xl mt-10">
        <h2 className="text-chrono-caption text-chrono-text-muted mb-2 tracking-wide uppercase">
          {t.recent}
        </h2>
        <p className="text-chrono-tiny text-chrono-text-muted/50">{t.noHistory}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="w-full max-w-4xl mt-10">
        <div className="rounded-lg border border-chrono-border/40 overflow-hidden divide-y divide-chrono-border/20">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="px-4 py-3 space-y-2">
              <div className="flex items-center gap-3">
                <div className="shimmer h-4 w-24 rounded" />
                <div className="ml-auto shimmer h-5 w-14 rounded-full" />
                <div className="shimmer h-3 w-10 rounded" />
              </div>
              <div className="shimmer h-3 w-40 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (items.length > 6) {
    const { tech, history } = groupByType(items);
    return (
      <div className="w-full max-w-4xl mt-10 space-y-6">
        {tech.length > 0 && (
          <HistoryGroup
            title={t.groupTech}
            items={tech}
            onSelectTopic={onSelectTopic}
            locale={locale}
            disabled={disabled}
          />
        )}
        {history.length > 0 && (
          <HistoryGroup
            title={t.groupHistory}
            items={history}
            onSelectTopic={onSelectTopic}
            locale={locale}
            disabled={disabled}
          />
        )}
      </div>
    );
  }

  const displayItems = expanded ? items : items.slice(0, 5);
  const hasMore = items.length > 5;

  return (
    <div className="w-full max-w-4xl mt-10">
      <HistoryGroup
        title={t.recent}
        items={displayItems}
        onSelectTopic={onSelectTopic}
        locale={locale}
        disabled={disabled}
      />
      {hasMore && !expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="mt-2 text-chrono-caption text-chrono-text-muted hover:text-chrono-accent transition-colors cursor-pointer"
        >
          {t.viewAll} ({items.length})
        </button>
      )}
    </div>
  );
}
