"use client";

import { useState } from "react";

interface Props {
  onSearch: (topic: string) => void;
  isPending: boolean;
  error: string | null;
}

export function SearchInput({ onSearch, isPending, error }: Props) {
  const [topic, setTopic] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!topic.trim() || isPending) return;
    onSearch(topic.trim());
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <h1 className="mb-2 text-5xl font-bold tracking-tight">Chrono</h1>
      <p className="mb-10 text-zinc-500">
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
          className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3
                     text-zinc-100 placeholder-zinc-600 outline-none
                     focus:border-zinc-600 transition-colors"
        />
        <button
          type="submit"
          disabled={isPending || !topic.trim()}
          className="rounded-lg bg-zinc-100 px-6 py-3 font-medium text-zinc-900
                     hover:bg-zinc-200 disabled:opacity-40 transition-colors cursor-pointer
                     disabled:cursor-not-allowed"
        >
          {isPending ? "Analyzing..." : "Research"}
        </button>
      </form>
      {error && (
        <p className="mt-4 text-sm text-red-400">{error}</p>
      )}
    </div>
  );
}
