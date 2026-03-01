"use client";

import Link from "next/link";
import type { Locale } from "@/data/landing";

interface Props {
  locale: Locale;
  onToggleLocale: () => void;
  topic?: string;
  activeYear?: string | null;
  activePhase?: string | null;
  showCTA?: boolean;
  ctaText?: string;
}

export function Navbar({
  locale,
  onToggleLocale,
  topic,
  activeYear,
  activePhase,
  showCTA = false,
  ctaText,
}: Props) {
  return (
    <nav className="sticky top-0 z-50 h-14 flex items-center justify-between px-6 bg-chrono-bg/80 backdrop-blur-md border-b border-chrono-border/30">
      <div className="flex items-center gap-4">
        <Link
          href="/"
          className="text-chrono-body font-bold text-chrono-accent tracking-wide hover:text-chrono-accent/80 transition-colors"
        >
          Chrono
        </Link>
        {topic && (
          <span className="text-chrono-caption text-chrono-text-secondary">
            {topic}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3 text-chrono-caption text-chrono-text-muted">
        {activePhase && <span>{activePhase}</span>}
        {activeYear && <span>{activeYear}</span>}
        <button
          onClick={onToggleLocale}
          className="rounded-md border border-chrono-border px-3 py-1 text-chrono-tiny text-chrono-text-secondary hover:border-chrono-border-active hover:text-chrono-text transition-colors cursor-pointer"
        >
          {locale === "en" ? "\u4e2d\u6587" : "EN"}
        </button>
        {showCTA && ctaText && (
          <Link
            href="/app"
            className="rounded-md border border-chrono-border px-4 py-1.5 text-chrono-caption font-medium text-chrono-text hover:border-chrono-accent hover:text-chrono-accent transition-colors"
          >
            {ctaText}
          </Link>
        )}
      </div>
    </nav>
  );
}
