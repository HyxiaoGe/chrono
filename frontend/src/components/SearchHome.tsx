"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createReplaySession } from "@/api/research";
import { useLocale } from "@/data/landing";
import type { ResearchSummary } from "@/types";
import { AppShell } from "./AppShell";
import { SearchInput } from "./SearchInput";

const ACTIVE_SESSION_KEY = "chrono-active-session";
const RESEARCH_MAINTENANCE_ENABLED = true;

interface ActiveSession {
  sessionId: string;
  topic: string;
}

function getActiveSession(): ActiveSession | null {
  try {
    const raw = localStorage.getItem(ACTIVE_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function SearchHome() {
  const router = useRouter();
  const [locale, toggleLocale] = useLocale();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const didInit = useRef(false);

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    const active = getActiveSession();
    if (active) {
      router.replace(`/app/session/${active.sessionId}`);
    }
  }, [router]);

  function handleSearch(topic: string) {
    setError(null);
    router.push(`/app/session/new?topic=${encodeURIComponent(topic)}`);
  }

  async function handleOpenResearch(research: ResearchSummary) {
    if (isPending) return;
    setIsPending(true);
    setError(null);
    try {
      const data = await createReplaySession(research.id);
      if (!data.session_id) {
        throw new Error("missing_session_id");
      }
      router.push(`/app/session/${data.session_id}`);
    } catch {
      setError(
        locale === "zh"
          ? "无法打开历史调研，请稍后重试。"
          : "Could not open this research. Please try again.",
      );
      setIsPending(false);
    }
  }

  return (
    <AppShell locale={locale} onToggleLocale={toggleLocale} mode="search">
      <SearchInput
        onSearch={handleSearch}
        isPending={isPending}
        error={error}
        onSelectTopic={handleSearch}
        onOpenResearch={handleOpenResearch}
        locale={locale}
        maintenance={RESEARCH_MAINTENANCE_ENABLED}
      />
    </AppShell>
  );
}
