"use client";

import Link from "next/link";
import type { Locale } from "@/data/landing";

interface Props {
  locale: Locale;
}

export function FooterCTA({ locale }: Props) {
  const isZh = locale === "zh";

  return (
    <section className="relative py-24 sm:py-32 px-4 overflow-hidden">
      {/* Amber glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[500px] w-[700px] rounded-full bg-chrono-accent/[0.05] blur-[120px]" />
      </div>

      <div className="relative mx-auto max-w-3xl text-center">
        <h2 className="text-3xl sm:text-4xl font-bold text-chrono-text">
          {isZh ? "准备好追溯你的主题了吗？" : "Ready to trace"}
          <span className="text-chrono-accent">
            {isZh ? "" : " your topic?"}
          </span>
        </h2>

        <div className="mt-8 flex items-center justify-center gap-4">
          <Link
            href="/app"
            className="rounded-lg bg-chrono-accent px-8 py-3 font-medium text-chrono-bg hover:bg-chrono-accent/90 transition-colors"
          >
            {isZh ? "试用 Chrono →" : "Try Chrono →"}
          </Link>
          <button className="rounded-lg border border-chrono-border/50 px-6 py-3 font-medium text-chrono-text-secondary hover:border-chrono-border hover:text-chrono-text transition-colors cursor-pointer">
            {isZh ? "观看 90s 演示" : "Watch a 90s demo"}
          </button>
        </div>
      </div>
    </section>
  );
}
