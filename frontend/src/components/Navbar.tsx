"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Locale } from "@/data/landing";
import { messages } from "@/data/landing";

interface Props {
  locale: Locale;
  onToggleLocale: () => void;
}

export function Navbar({ locale, onToggleLocale }: Props) {
  const pathname = usePathname();
  const t = messages[locale].nav;

  const isHome = pathname === "/";
  const isApp = pathname.startsWith("/app");

  return (
    <nav className="sticky top-0 z-50 h-14 flex items-center justify-between px-6 bg-chrono-bg/80 backdrop-blur-md border-b border-chrono-border/30">
      <Link
        href="/"
        className="text-chrono-body font-bold text-chrono-accent tracking-wide hover:text-chrono-accent/80 transition-colors"
      >
        Chrono
      </Link>

      <div className="flex items-center gap-1">
        <Link
          href="/"
          className={`rounded-md px-3 py-1.5 text-chrono-caption transition-colors ${
            isHome
              ? "text-chrono-text"
              : "text-chrono-text-muted hover:text-chrono-text-secondary"
          }`}
        >
          {t.home}
        </Link>
        <Link
          href="/app"
          className={`rounded-md px-3 py-1.5 text-chrono-caption transition-colors ${
            isApp
              ? "text-chrono-text"
              : "text-chrono-text-muted hover:text-chrono-text-secondary"
          }`}
        >
          {t.getStarted}
        </Link>
        <div className="ml-2 flex h-7 items-center rounded-md border border-chrono-border bg-chrono-bg/50 p-0.5">
          <button
            onClick={() => locale !== "en" && onToggleLocale()}
            className={`rounded px-2.5 py-0.5 text-chrono-tiny transition-colors cursor-pointer ${
              locale === "en"
                ? "bg-chrono-surface text-chrono-text"
                : "text-chrono-text-muted hover:text-chrono-text-secondary"
            }`}
          >
            EN
          </button>
          <button
            onClick={() => locale !== "zh" && onToggleLocale()}
            className={`rounded px-2.5 py-0.5 text-chrono-tiny transition-colors cursor-pointer ${
              locale === "zh"
                ? "bg-chrono-surface text-chrono-text"
                : "text-chrono-text-muted hover:text-chrono-text-secondary"
            }`}
          >
            {"\u4e2d\u6587"}
          </button>
        </div>
      </div>
    </nav>
  );
}
