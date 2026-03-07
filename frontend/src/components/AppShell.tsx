"use client";

import { Navbar } from "./Navbar";
import type { Locale } from "@/data/landing";

type NavbarMode = "landing" | "search" | "session";

interface Props {
  locale: Locale;
  onToggleLocale: () => void;
  mode?: NavbarMode;
  topic?: string;
  activeYear?: string | null;
  activePhase?: string | null;
  onBack?: () => void;
  children: React.ReactNode;
}

export function AppShell({
  locale,
  onToggleLocale,
  mode = "search",
  topic,
  activeYear,
  activePhase,
  onBack,
  children,
}: Props) {
  return (
    <div className="min-h-screen bg-chrono-bg">
      <Navbar
        locale={locale}
        onToggleLocale={onToggleLocale}
        mode={mode}
        topic={topic}
        activeYear={activeYear}
        activePhase={activePhase}
        onBack={onBack}
      />
      {children}
    </div>
  );
}
