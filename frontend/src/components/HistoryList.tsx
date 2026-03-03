"use client";

import { useEffect, useState } from "react";
import type { ResearchSummary } from "@/types";
import type { Locale } from "@/data/landing";
import { messages } from "@/data/landing";

interface Props {
  onSelectTopic: (topic: string) => void;
  locale: Locale;
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

function CardGrid({
  items,
  onSelectTopic,
  locale,
}: {
  items: ResearchSummary[];
  onSelectTopic: (topic: string) => void;
  locale: Locale;
}) {
  const t = messages[locale].app;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => onSelectTopic(item.topic)}
          className="group rounded-lg border border-chrono-border bg-chrono-surface px-4 py-3
                     text-left hover:border-chrono-border-active hover:bg-chrono-surface-hover
                     transition-colors cursor-pointer"
        >
          {/* Row 1: topic + complexity */}
          <div className="flex items-center justify-between">
            <p className="text-chrono-body text-chrono-text font-medium truncate">
              {item.topic}
            </p>
            <span className="shrink-0 ml-2 rounded bg-chrono-bg px-1.5 py-0.5 text-chrono-tiny text-chrono-text-muted">
              {item.complexity_level}
            </span>
          </div>

          {/* Row 2: timeline_span + nodes */}
          <div className="flex items-center justify-between mt-1.5">
            {item.timeline_span ? (
              <span className="text-chrono-tiny text-chrono-text-muted truncate mr-2">
                {item.timeline_span}
              </span>
            ) : (
              <span />
            )}
            <span className="shrink-0 text-chrono-tiny text-chrono-text-muted">
              {item.total_nodes} {t.nodes}
            </span>
          </div>

          {/* Row 3: key_insight preview */}
          {item.key_insight && (
            <p className="mt-1.5 text-chrono-tiny text-chrono-text-muted/70 line-clamp-1">
              {item.key_insight}
            </p>
          )}

          {/* Row 4: relative time */}
          <p className="mt-1.5 text-chrono-tiny text-chrono-text-muted/50">
            {formatRelativeTime(item.created_at, locale)}
          </p>
        </button>
      ))}
    </div>
  );
}

export function HistoryList({ onSelectTopic, locale }: Props) {
  const [items, setItems] = useState<ResearchSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
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

  if (error || (!loading && items.length === 0)) return null;

  if (loading) {
    return (
      <div className="w-full max-w-2xl mt-10">
        <h2 className="text-chrono-caption text-chrono-text-muted mb-3 tracking-wide uppercase">
          &nbsp;
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div
              key={i}
              className="h-28 rounded-lg bg-chrono-surface animate-skeleton-shimmer"
            />
          ))}
        </div>
      </div>
    );
  }

  // Conditional grouping: >6 items → group by topic_type
  if (items.length > 6) {
    const { tech, history } = groupByType(items);
    return (
      <div className="w-full max-w-2xl mt-10 space-y-8">
        {tech.length > 0 && (
          <div>
            <h2 className="text-chrono-caption text-chrono-text-muted mb-3 tracking-wide uppercase">
              {t.groupTech}
            </h2>
            <CardGrid
              items={tech}
              onSelectTopic={onSelectTopic}
              locale={locale}
            />
          </div>
        )}
        {history.length > 0 && (
          <div>
            <h2 className="text-chrono-caption text-chrono-text-muted mb-3 tracking-wide uppercase">
              {t.groupHistory}
            </h2>
            <CardGrid
              items={history}
              onSelectTopic={onSelectTopic}
              locale={locale}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mt-10">
      <h2 className="text-chrono-caption text-chrono-text-muted mb-3 tracking-wide uppercase">
        {t.recent}
      </h2>
      <CardGrid items={items} onSelectTopic={onSelectTopic} locale={locale} />
    </div>
  );
}
