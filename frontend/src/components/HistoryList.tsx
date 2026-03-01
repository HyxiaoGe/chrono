"use client";

import { useEffect, useState } from "react";
import type { ResearchSummary } from "@/types";

interface Props {
  onSelectTopic: (topic: string) => void;
}

function formatRelativeTime(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export function HistoryList({ onSelectTopic }: Props) {
  const [items, setItems] = useState<ResearchSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

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

  const isZh = items[0]?.language === "zh";

  return (
    <div className="w-full max-w-md mt-10">
      <h2 className="text-chrono-caption text-chrono-text-muted mb-3 tracking-wide uppercase">
        {loading ? "\u00A0" : isZh ? "最近的调研" : "Recent"}
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
                  {isZh
                    ? `${item.total_nodes} 个节点`
                    : `${item.total_nodes} nodes`}
                </p>
                <p className="text-chrono-tiny text-chrono-text-muted mt-1">
                  {formatRelativeTime(item.created_at)}
                </p>
              </button>
            ))}
      </div>
    </div>
  );
}
