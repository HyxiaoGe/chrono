"use client";

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

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center px-4">
      <div className="animate-slide-up w-full max-w-lg rounded-2xl border border-chrono-border bg-chrono-surface/80 p-8 backdrop-blur-sm">
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
        </div>
        <p className="mt-2 text-chrono-body text-chrono-text-secondary">
          {user_facing.summary}
        </p>

        <div className="mt-6">
          <h3 className="text-chrono-tiny font-medium uppercase tracking-wider text-chrono-text-muted">
            {t.researchDimensions}
          </h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {research_threads.map((thread) => (
              <span
                key={thread.name}
                className="rounded-full border border-chrono-border px-3 py-1 text-sm text-chrono-text-secondary"
                style={{ opacity: 0.4 + thread.priority * 0.12 }}
              >
                {thread.name}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-6 flex gap-6 text-chrono-caption text-chrono-text-muted">
          <span>{user_facing.duration_text}</span>
          <span>{user_facing.credits_text}</span>
          <span>~{complexity.estimated_total_nodes} nodes</span>
        </div>

        <div className="mt-8 flex gap-3">
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
