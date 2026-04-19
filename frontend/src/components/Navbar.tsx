"use client";

import Link from "next/link";
import { Globe } from "lucide-react";
import type { Locale } from "@/data/landing";
import { messages } from "@/data/landing";

type NavbarMode = "landing" | "search" | "session";

interface Props {
  locale: Locale;
  onToggleLocale: () => void;
  mode?: NavbarMode;
  topic?: string;
  activeYear?: string | null;
  activePhase?: string | null;
  onBack?: () => void;
}

function LogoMark() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0"
    >
      <line x1="9" y1="2" x2="9" y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="9" cy="3.5" r="2" fill="currentColor" opacity="0.4" />
      <circle cx="9" cy="9" r="2.5" fill="currentColor" />
      <circle cx="9" cy="14.5" r="2" fill="currentColor" opacity="0.4" />
    </svg>
  );
}

function LanguageToggle({ locale, onToggleLocale }: { locale: Locale; onToggleLocale: () => void }) {
  return (
    <button
      onClick={onToggleLocale}
      className="flex items-center justify-center size-8 rounded-md text-chrono-text-muted hover:text-chrono-text-secondary hover:bg-chrono-surface/60 transition-colors cursor-pointer"
      title={locale === "zh" ? "Switch to English" : "切换到中文"}
    >
      <Globe size={16} />
    </button>
  );
}

export function Navbar({
  locale,
  onToggleLocale,
  mode = "search",
  topic,
  activeYear,
  activePhase,
  onBack,
}: Props) {
  const t = messages[locale].nav;
  const isZh = locale === "zh";

  // Landing mode — full prototype-faithful navbar
  if (mode === "landing") {
    return (
      <nav className="sticky top-0 z-50 h-14 flex items-center px-8 bg-chrono-bg/80 backdrop-blur-md border-b border-chrono-border/30">
        <Link href="/" className="flex items-center gap-1.5 text-chrono-accent">
          <LogoMark />
          <span className="text-chrono-body font-bold tracking-wide">Chrono</span>
        </Link>
        <span className="ml-3 rounded-full border border-chrono-border/50 px-2 py-0.5 text-[10px] tracking-wider uppercase text-chrono-text-muted">
          Beta
        </span>

        <div className="ml-10 hidden md:flex items-center gap-7 text-chrono-caption text-chrono-text-muted">
          <a href="#how" className="hover:text-chrono-text-secondary transition-colors">
            {isZh ? "工作原理" : "How it works"}
          </a>
          <a href="#explore" className="hover:text-chrono-text-secondary transition-colors">
            {isZh ? "探索" : "Explore"}
          </a>
          <a href="#recent" className="hover:text-chrono-text-secondary transition-colors">
            {isZh ? "画廊" : "Gallery"}
          </a>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <LanguageToggle locale={locale} onToggleLocale={onToggleLocale} />
          <span className="hidden sm:inline text-chrono-caption text-chrono-text-muted hover:text-chrono-text-secondary px-2 py-1 transition-colors cursor-pointer">
            {isZh ? "登录" : "Sign in"}
          </span>
          <Link
            href="/app"
            className="rounded-md bg-chrono-accent px-3 py-1.5 text-chrono-caption font-medium text-chrono-bg hover:bg-chrono-accent/90 transition-colors"
          >
            {isZh ? "试用 Chrono →" : "Try Chrono →"}
          </Link>
        </div>
      </nav>
    );
  }

  // Search / Session modes — existing navbar
  return (
    <nav className="sticky top-0 z-50 h-14 flex items-center px-6 bg-chrono-bg/80 backdrop-blur-md border-b border-chrono-border/30">
      {/* Left */}
      <div className="flex items-center gap-2 min-w-0">
        {mode === "session" && onBack && (
          <button
            onClick={onBack}
            className="text-chrono-text-muted hover:text-chrono-text-secondary transition-colors cursor-pointer mr-1"
            title={isZh ? "\u8fd4\u56de" : "Back"}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}

        <Link
          href={mode === "session" ? "/app" : "/"}
          onClick={mode === "session" && onBack ? (e) => { e.preventDefault(); onBack(); } : undefined}
          className="flex items-center gap-1.5 text-chrono-accent hover:text-chrono-accent/80 transition-colors"
        >
          <LogoMark />
          <span className="text-chrono-body font-bold tracking-wide">Chrono</span>
        </Link>

        {mode === "session" && topic && (
          <>
            <span className="text-chrono-border mx-1.5">{"\u00b7"}</span>
            <span className="text-chrono-caption text-chrono-text-secondary truncate">
              {topic}
            </span>
          </>
        )}
      </div>

      {/* Right */}
      <div className="ml-auto flex items-center gap-3">
        {mode === "session" && activePhase && (
          <div className="hidden sm:flex items-center gap-2 text-chrono-tiny text-chrono-text-muted">
            <span>{activePhase}</span>
          </div>
        )}

        <LanguageToggle locale={locale} onToggleLocale={onToggleLocale} />
      </div>
    </nav>
  );
}
