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

  return (
    <div className="w-full max-w-md mt-10">
      <h2 className="text-chrono-caption text-chrono-text-muted mb-3 tracking-wide uppercase">
        {loading ? "\u00A0" : t.recent}
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {loading
          ? Array.from({ length: 3 }, (_, i) => (
              <div
                key={i}
                className="h-24 rounded-lg bg-chrono-surface animate-skeleton-shimmer"
              />
            ))
          : items.map((item) => (
              <button
                key={item.id}
                onClick={() => onSelectTopic(item.topic)}
                className="rounded-lg border border-chrono-border bg-chrono-surface px-3 py-3
                           text-left hover:border-chrono-border-active hover:bg-chrono-surface-hover
                           transition-colors cursor-pointer"
              >
                <p className="text-chrono-body text-chrono-text truncate font-medium">
                  {item.topic}
                </p>
                <p className="text-chrono-tiny text-chrono-text-muted mt-1">
                  <span className="inline-block rounded bg-chrono-bg px-1.5 py-0.5 mr-1">
                    {item.complexity_level}
                  </span>
                  {item.total_nodes} {t.nodes}
                </p>
                <p className="text-chrono-tiny text-chrono-text-muted mt-1">
                  {formatRelativeTime(item.created_at, locale)}
                </p>
              </button>
            ))}
      </div>
    </div>
  );
}
