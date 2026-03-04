"use client";

import { useState } from "react";
import type { Locale } from "@/data/landing";
import { messages } from "@/data/landing";
import { HistoryList } from "./HistoryList";
import { RecommendedTopics } from "./RecommendedTopics";

interface Props {
  onSearch: (topic: string) => void;
  isPending: boolean;
  error: string | null;
  onSelectTopic: (topic: string) => void;
  locale: Locale;
}

export function SearchInput({ onSearch, isPending, error, onSelectTopic, locale }: Props) {
  const [topic, setTopic] = useState("");
  const t = messages[locale].app;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!topic.trim() || isPending) return;
    onSearch(topic.trim());
  }

  return (
    <div className="animate-fade-in flex min-h-[calc(100vh-3.5rem)] flex-col items-center px-4 sm:px-6 pt-[8vh] pb-16">
      <h1 className="mb-2 text-chrono-hero font-bold tracking-wider text-chrono-accent">
        {t.title}
      </h1>
      <p className="mb-10 text-chrono-text-muted">
        {t.subtitle}
      </p>
      <form onSubmit={handleSubmit} className="flex w-full max-w-xl gap-3">
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder={t.placeholder}
          disabled={isPending}
          autoFocus
          className="flex-1 rounded-lg border border-chrono-border bg-chrono-surface px-4 py-3
                     text-chrono-text placeholder-chrono-text-muted outline-none
                     focus:border-chrono-border-active transition-colors"
        />
        <button
          type="submit"
          disabled={isPending || !topic.trim()}
          className="rounded-lg bg-chrono-text px-6 py-3 font-medium text-chrono-bg
                     hover:bg-chrono-text/90 disabled:opacity-40 transition-colors cursor-pointer
                     disabled:cursor-not-allowed"
        >
          {isPending ? t.analyzing : t.research}
        </button>
      </form>
      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      <RecommendedTopics onSelectTopic={onSelectTopic} locale={locale} />
      <div className="w-full max-w-4xl mt-10 border-t border-chrono-border/30" />
      <HistoryList onSelectTopic={onSelectTopic} locale={locale} />
    </div>
  );
}
