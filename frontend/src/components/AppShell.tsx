"use client";

import { Navbar } from "./Navbar";
import type { Locale } from "@/data/landing";

interface Props {
  locale: Locale;
  onToggleLocale: () => void;
  topic?: string;
  activeYear?: string | null;
  activePhase?: string | null;
  showResearchBar?: boolean;
  onNewResearch?: () => void;
  children: React.ReactNode;
}

export function AppShell({
  locale,
  onToggleLocale,
  topic,
  activeYear,
  activePhase,
  showResearchBar = false,
  onNewResearch,
  children,
}: Props) {
  return (
    <div className="min-h-screen bg-chrono-bg">
      <Navbar locale={locale} onToggleLocale={onToggleLocale} />

      {showResearchBar && (
        <div className="sticky top-14 z-40 flex h-10 items-center justify-between border-b border-chrono-border/20 bg-chrono-bg/60 px-6 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            {onNewResearch && (
              <button
                onClick={onNewResearch}
                className="text-chrono-caption text-chrono-text-muted hover:text-chrono-text-secondary transition-colors cursor-pointer"
                title={locale === "zh" ? "新建调研" : "New research"}
              >
                &larr;
              </button>
            )}
            <span className="text-chrono-caption text-chrono-text-secondary">
              {topic}
            </span>
          </div>
          <div className="flex items-center gap-3 text-chrono-caption text-chrono-text-muted">
            {activePhase && <span>{activePhase}</span>}
            {activeYear && <span>{activeYear}</span>}
          </div>
        </div>
      )}

      {children}
    </div>
  );
}
