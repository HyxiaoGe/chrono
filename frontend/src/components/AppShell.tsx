"use client";

import { Navbar } from "./Navbar";
import type { Locale } from "@/data/landing";

interface Props {
  topic?: string;
  showResearchInfo: boolean;
  activeYear?: string | null;
  activePhase?: string | null;
  locale: Locale;
  onToggleLocale: () => void;
  children: React.ReactNode;
}

export function AppShell({
  topic,
  showResearchInfo,
  activeYear,
  activePhase,
  locale,
  onToggleLocale,
  children,
}: Props) {
  return (
    <div className="min-h-screen bg-chrono-bg">
      <Navbar
        locale={locale}
        onToggleLocale={onToggleLocale}
        topic={showResearchInfo ? topic : undefined}
        activeYear={showResearchInfo ? activeYear : undefined}
        activePhase={showResearchInfo ? activePhase : undefined}
      />
      {children}
    </div>
  );
}
