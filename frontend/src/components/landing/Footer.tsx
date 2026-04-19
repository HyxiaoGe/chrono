"use client";

import Link from "next/link";
import type { Locale } from "@/data/landing";

interface Props {
  locale: Locale;
}

export function Footer({ locale }: Props) {
  const isZh = locale === "zh";

  return (
    <footer className="border-t border-chrono-border/30 px-4 py-10">
      <div className="mx-auto max-w-5xl">
        {/* Top row */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-chrono-accent mb-1">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="shrink-0">
                <line x1="9" y1="2" x2="9" y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <circle cx="9" cy="3.5" r="2" fill="currentColor" opacity="0.4" />
                <circle cx="9" cy="9" r="2.5" fill="currentColor" />
                <circle cx="9" cy="14.5" r="2" fill="currentColor" opacity="0.4" />
              </svg>
              <span className="font-bold text-chrono-body tracking-wide">Chrono</span>
            </div>
            <p className="text-chrono-tiny text-chrono-text-muted">
              {isZh ? "多智能体 AI 时间线调研系统" : "Multi-agent AI timeline research system"}
            </p>
          </div>

          <div className="flex items-center gap-6 text-chrono-caption text-chrono-text-muted">
            <Link href="#" className="hover:text-chrono-text-secondary transition-colors">
              Changelog
            </Link>
            <Link href="https://github.com/HyxiaoGe/chrono" target="_blank" className="hover:text-chrono-text-secondary transition-colors">
              GitHub
            </Link>
            <Link href="#" className="hover:text-chrono-text-secondary transition-colors">
              Privacy
            </Link>
            <Link href="#" className="hover:text-chrono-text-secondary transition-colors">
              Terms
            </Link>
          </div>
        </div>

        {/* Bottom row */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-chrono-tiny text-chrono-text-muted">
          <span>&copy; 2026 Chrono Labs</span>
          <div className="flex items-center gap-3">
            <span>v0.1.0</span>
            <span className="flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-green-500" />
              {isZh ? "正常运行" : "Operational"}
            </span>
            <span>{isZh ? "简体中文" : "English"}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
