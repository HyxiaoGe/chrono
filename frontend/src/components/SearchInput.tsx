"use client";

import { useState } from "react";
import type { Locale } from "@/data/landing";
import { messages } from "@/data/landing";
import { HistoryList } from "./HistoryList";

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
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center pt-[15vh] px-4">
      <h1 className="mb-2 text-chrono-hero font-bold tracking-wider text-chrono-accent">
        {t.title}
      </h1>
      <p className="mb-10 text-chrono-text-muted">
        {t.subtitle}
      </p>
      <form onSubmit={handleSubmit} className="flex w-full max-w-md gap-3">
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

      {/* Suggested topics */}
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        <span className="text-chrono-caption text-chrono-text-muted">
          {t.tryLabel}:
        </span>
        {t.suggestedTopics.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setTopic(s)}
            className="rounded-full border border-chrono-border/50 px-3 py-1 text-chrono-caption
                       text-chrono-text-muted hover:border-chrono-accent hover:text-chrono-accent
                       transition-colors cursor-pointer"
          >
            {s}
          </button>
        ))}
      </div>

      <HistoryList onSelectTopic={onSelectTopic} locale={locale} />
    </div>
  );
}
