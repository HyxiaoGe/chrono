"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/data/landing";
import { AppShell } from "./AppShell";
import { SearchInput } from "./SearchInput";

const ACTIVE_SESSION_KEY = "chrono-active-session";

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
    router.push(`/app/session/new?topic=${encodeURIComponent(topic)}`);
  }

  return (
    <AppShell locale={locale} onToggleLocale={toggleLocale} mode="search">
      <SearchInput
        onSearch={handleSearch}
        isPending={false}
        error={null}
        onSelectTopic={handleSearch}
        locale={locale}
      />
    </AppShell>
  );
}
