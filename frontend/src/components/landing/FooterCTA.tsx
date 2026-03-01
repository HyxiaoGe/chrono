import Link from "next/link";
import type { Locale } from "@/data/landing";
import { messages } from "@/data/landing";

interface Props {
  locale: Locale;
}

export function FooterCTA({ locale }: Props) {
  const t = messages[locale].footer;

  return (
    <footer className="py-24 sm:py-32 px-4 border-t border-chrono-border/30">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="text-3xl sm:text-4xl font-bold text-chrono-text">
          {t.heading}
        </h2>
        <Link
          href="/app"
          className="inline-block mt-8 rounded-lg bg-chrono-accent px-8 py-3 font-medium text-chrono-bg hover:bg-chrono-accent/90 transition-colors"
        >
          {t.cta}
        </Link>
        <p className="mt-16 text-chrono-tiny text-chrono-text-muted">
          {t.copyright}
        </p>
      </div>
    </footer>
  );
}
