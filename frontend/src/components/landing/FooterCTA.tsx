import Link from "next/link";
import type { Locale } from "@/data/landing";
import { messages } from "@/data/landing";

interface Props {
  locale: Locale;
}

export function FooterCTA({ locale }: Props) {
  const t = messages[locale].footer;

  return (
    <footer className="relative py-24 sm:py-32 px-4 border-t border-chrono-border/30 overflow-hidden">
      {/* Background glow */}
      <div className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 h-[400px] w-[600px] rounded-full bg-chrono-accent/[0.03] blur-[100px]" />

      <div className="relative mx-auto max-w-3xl text-center">
        <h2 className="text-3xl sm:text-4xl font-bold text-chrono-text">
          {t.heading}
        </h2>
        <p className="mt-4 text-chrono-body text-chrono-text-muted">
          {locale === "zh" ? "多智能体协作，几分钟生成完整时间线" : "Multi-agent AI research, delivered in minutes"}
        </p>
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
