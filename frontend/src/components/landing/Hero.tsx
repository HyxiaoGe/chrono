import Link from "next/link";
import type { Locale } from "@/data/landing";
import { messages } from "@/data/landing";
import { DemoPlayer } from "@/components/DemoPlayer";

interface Props {
  locale: Locale;
}

export function Hero({ locale }: Props) {
  const t = messages[locale].hero;

  return (
    <section className="pt-24 sm:pt-32 pb-16 px-4">
      <div className="mx-auto max-w-4xl text-center">
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-chrono-text">
          {t.title}
        </h1>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-chrono-accent mt-2">
          {t.titleAccent}
        </h1>
        <p className="mt-6 text-chrono-body text-chrono-text-secondary max-w-2xl mx-auto">
          {t.subtitle}
        </p>
        <Link
          href="/app"
          className="inline-block mt-8 rounded-lg bg-chrono-accent px-8 py-3 font-medium text-chrono-bg hover:bg-chrono-accent/90 transition-colors"
        >
          {t.cta}
        </Link>
      </div>
      <div className="mx-auto mt-16 max-w-4xl">
        <DemoPlayer locale={locale} />
      </div>
    </section>
  );
}
