"use client";

import Link from "next/link";
import type { Locale } from "@/data/landing";

interface Props {
  topic?: string;
  showResearchInfo: boolean;
  activeYear?: string | null;
  activePhase?: string | null;
  locale: Locale;
  onToggleLocale: () => void;
  children: React.ReactNode;
}

export function AppShell({
  topic,
  showResearchInfo,
  activeYear,
  activePhase,
  locale,
  onToggleLocale,
  children,
}: Props) {
  return (
    <div className="min-h-screen bg-chrono-bg">
      <header className="sticky top-0 z-40 flex h-12 items-center border-b border-chrono-border/50 bg-chrono-bg/80 px-6 backdrop-blur-md">
        <Link
          href="/"
          className="text-chrono-caption font-semibold tracking-wider text-chrono-accent hover:text-chrono-accent/80 transition-colors"
        >
          Chrono
        </Link>
        {showResearchInfo && topic && (
          <span className="ml-4 text-chrono-caption text-chrono-text-secondary">
            {topic}
          </span>
        )}
        <div className="ml-auto flex items-center gap-3 text-chrono-caption text-chrono-text-muted">
          {showResearchInfo && activePhase && <span>{activePhase}</span>}
          {showResearchInfo && activeYear && <span>{activeYear}</span>}
          <button
            onClick={onToggleLocale}
            className="rounded-md border border-chrono-border px-2.5 py-0.5 text-chrono-tiny text-chrono-text-secondary hover:border-chrono-border-active hover:text-chrono-text transition-colors cursor-pointer"
          >
            {locale === "en" ? "\u4e2d\u6587" : "EN"}
          </button>
        </div>
      </header>
      {children}
    </div>
  );
}
