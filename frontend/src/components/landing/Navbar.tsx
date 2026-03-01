import Link from "next/link";
import type { Locale } from "@/data/landing";
import { messages } from "@/data/landing";

interface Props {
  locale: Locale;
  onToggleLocale: () => void;
}

export function Navbar({ locale, onToggleLocale }: Props) {
  const t = messages[locale];

  return (
    <nav className="sticky top-0 z-50 h-14 flex items-center justify-between px-6 bg-chrono-bg/80 backdrop-blur-md border-b border-chrono-border/30">
      <span className="text-chrono-body font-bold text-chrono-accent tracking-wide">
        Chrono
      </span>
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleLocale}
          className="rounded-md border border-chrono-border px-3 py-1 text-chrono-tiny text-chrono-text-secondary hover:border-chrono-border-active hover:text-chrono-text transition-colors cursor-pointer"
        >
          {locale === "en" ? "\u4e2d\u6587" : "EN"}
        </button>
        <Link
          href="/app"
          className="rounded-md border border-chrono-border px-4 py-1.5 text-chrono-caption font-medium text-chrono-text hover:border-chrono-accent hover:text-chrono-accent transition-colors"
        >
          {t.nav.cta}
        </Link>
      </div>
    </nav>
  );
}
