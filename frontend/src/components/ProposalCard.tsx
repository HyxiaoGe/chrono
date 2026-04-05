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

const LEVEL_FILL: Record<string, number> = {
  light: 1,
  medium: 2,
  deep: 3,
  epic: 4,
};

const LEVEL_BAR_COLOR: Record<string, string> = {
  light: "bg-chrono-level-light",
  medium: "bg-chrono-level-medium",
  deep: "bg-chrono-level-deep",
  epic: "bg-chrono-level-epic",
};

const LEVEL_TEXT_COLOR: Record<string, string> = {
  light: "text-chrono-level-light",
  medium: "text-chrono-level-medium",
  deep: "text-chrono-level-deep",
  epic: "text-chrono-level-epic",
};

const LEVEL_LABEL: Record<string, [string, string]> = {
  light:  ["轻量", "Light"],
  medium: ["标准", "Standard"],
  deep:   ["深度", "Deep"],
  epic:   ["史诗", "Epic"],
};

export function ProposalCard({ proposal, onConfirm, onCancel, locale }: Props) {
  const { user_facing, complexity, research_threads } = proposal;
  const activeFill = LEVEL_FILL[complexity.level] ?? 1;
  const barColor = LEVEL_BAR_COLOR[complexity.level] ?? "bg-chrono-accent";
  const textColor = LEVEL_TEXT_COLOR[complexity.level] ?? "text-chrono-accent";
  const [labelZh, labelEn] = LEVEL_LABEL[complexity.level] ?? ["深度", "Deep"];
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
        <h2 className="text-chrono-title font-bold text-chrono-text">
          {user_facing.title}
        </h2>

        {/* Complexity bar + time span */}
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex flex-1 gap-1">
              {Array.from({ length: 4 }, (_, i) => (
                <div
                  key={i}
                  className={`h-1 flex-1 rounded-full transition-all ${
                    i < activeFill ? barColor : "bg-chrono-border/40"
                  }`}
                />
              ))}
            </div>
            <span className={`text-chrono-tiny font-semibold ${textColor}`}>
              {locale === "zh" ? labelZh : labelEn}
            </span>
          </div>

          {/* Mini timeline span */}
          <div className="flex items-center gap-2">
            <span className="text-chrono-tiny text-chrono-text-muted tabular-nums">
              {complexity.time_span.split(/[–—-]/)[0]?.trim() || complexity.time_span}
            </span>
            <div className="relative flex-1">
              <div className="h-px w-full bg-chrono-border/50" />
              <div className="absolute left-0 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-chrono-accent/50" />
              <div className="absolute right-0 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-chrono-accent/50" />
            </div>
            <span className="text-chrono-tiny text-chrono-text-muted tabular-nums">
              {complexity.time_span.split(/[–—-]/)[1]?.trim() || ""}
            </span>
          </div>
        </div>

        <p className="mt-3 text-chrono-body text-chrono-text-secondary">
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
                className={`flex items-start gap-3 rounded-lg bg-chrono-bg/50 py-2.5 pl-3 pr-3 border-l-2 ${
                  thread.priority >= 4 ? "border-chrono-accent" : "border-chrono-border/40"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-chrono-caption font-medium ${
                      thread.priority >= 4 ? "text-chrono-text" : "text-chrono-text-secondary"
                    }`}>
                      {thread.name}
                    </span>
                    <span className="shrink-0 rounded-full bg-chrono-border/30 px-2 py-0.5 text-chrono-tiny text-chrono-text-muted">
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

        <div className="mt-6 flex items-center gap-4">
          <button
            onClick={onConfirm}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-chrono-accent py-3 font-semibold text-chrono-bg transition-colors hover:bg-chrono-accent/90 cursor-pointer"
          >
            {t.startResearch}
            <span aria-hidden>→</span>
          </button>
          <button
            onClick={onCancel}
            className="text-chrono-caption text-chrono-text-muted transition-colors hover:text-chrono-text-secondary cursor-pointer"
          >
            {t.cancel}
          </button>
        </div>
      </div>
    </div>
  );
}
