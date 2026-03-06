"use client";

import { useEffect, useRef } from "react";
import type { ResearchProposal } from "@/types";
import type { Locale } from "@/data/landing";
import { messages } from "@/data/landing";

interface Props {
  proposal: ResearchProposal;
  onConfirm: () => void;
  onCancel: () => void;
  locale: Locale;
}

const LEVEL_DOTS: Record<string, number> = {
  light: 1,
  medium: 2,
  deep: 3,
  epic: 4,
};

const LEVEL_DOT_COLOR: Record<string, string> = {
  light: "bg-chrono-level-light",
  medium: "bg-chrono-level-medium",
  deep: "bg-chrono-level-deep",
  epic: "bg-chrono-level-epic",
};

export function ProposalCard({ proposal, onConfirm, onCancel, locale }: Props) {
  const { user_facing, complexity, research_threads } = proposal;
  const activeDots = LEVEL_DOTS[complexity.level] ?? 1;
  const dotColor = LEVEL_DOT_COLOR[complexity.level] ?? "bg-chrono-accent";
  const t = messages[locale].app;
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  function handleBackdropClick(e: React.MouseEvent) {
    if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
      onCancel();
    }
  }

  return (
    <div
      className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center px-4"
      onClick={handleBackdropClick}
    >
      <div ref={cardRef} className="animate-slide-up w-full max-w-xl rounded-2xl border border-chrono-border bg-chrono-surface/80 p-8 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <h2 className="text-chrono-title font-bold text-chrono-text">
            {user_facing.title}
          </h2>
          <div className="flex gap-1">
            {Array.from({ length: 4 }, (_, i) => (
              <div
                key={i}
                className={`h-2 w-2 rounded-full ${
                  i < activeDots ? dotColor : "bg-chrono-border"
                }`}
              />
            ))}
          </div>
          <span className="text-chrono-caption text-chrono-text-muted">
            {complexity.time_span}
          </span>
        </div>
        <p className="mt-2 text-chrono-body text-chrono-text-secondary">
          {user_facing.summary}
        </p>

        <div className="mt-6">
          <h3 className="text-chrono-tiny font-medium uppercase tracking-wider text-chrono-text-muted">
            {t.researchDimensions}
          </h3>
          <div className="mt-3 space-y-2">
            {research_threads.map((thread) => (
              <div
                key={thread.name}
                className="flex items-start gap-3 rounded-lg bg-chrono-bg/50 px-3 py-2"
              >
                <div className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                  thread.priority >= 4 ? "bg-chrono-accent" : "bg-chrono-text-muted/50"
                }`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-chrono-caption font-medium text-chrono-text-secondary">
                      {thread.name}
                    </span>
                    <span className="shrink-0 text-chrono-tiny text-chrono-text-muted">
                      ~{thread.estimated_nodes} {locale === "zh" ? "节点" : "nodes"}
                    </span>
                  </div>
                  <p className="mt-0.5 text-chrono-tiny text-chrono-text-muted line-clamp-1">
                    {thread.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 flex items-center gap-2 text-chrono-caption text-chrono-text-muted">
          <span>{user_facing.duration_text}</span>
          <span>·</span>
          <span>{user_facing.credits_text}</span>
          <span>·</span>
          <span>~{complexity.estimated_total_nodes} {locale === "zh" ? "个节点" : "nodes"}</span>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={onConfirm}
            className="flex-1 rounded-lg bg-chrono-text py-3 font-medium text-chrono-bg
                       hover:bg-chrono-text/90 transition-colors cursor-pointer"
          >
            {t.startResearch}
          </button>
          <button
            onClick={onCancel}
            className="rounded-lg border border-chrono-border px-6 py-3 text-chrono-text-muted
                       hover:border-chrono-border-active hover:text-chrono-text-secondary transition-colors cursor-pointer"
          >
            {t.cancel}
          </button>
        </div>
      </div>
    </div>
  );
}
