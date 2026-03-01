"use client";

import { useState } from "react";
import { HistoryList } from "./HistoryList";

interface Props {
  onSearch: (topic: string) => void;
  isPending: boolean;
  error: string | null;
  onSelectTopic: (topic: string) => void;
}

export function SearchInput({ onSearch, isPending, error, onSelectTopic }: Props) {
  const [topic, setTopic] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!topic.trim() || isPending) return;
    onSearch(topic.trim());
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <h1 className="mb-2 text-chrono-hero font-bold tracking-wider text-chrono-accent">
        Chrono
      </h1>
      <p className="mb-10 text-chrono-text-muted">
        Enter any topic. AI researches its timeline.
      </p>
      <form onSubmit={handleSubmit} className="flex w-full max-w-md gap-3">
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="iPhone, 比特币, Cold War..."
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
          {isPending ? "Analyzing..." : "Research"}
        </button>
      </form>
      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
      <HistoryList onSelectTopic={onSelectTopic} />
    </div>
  );
}
