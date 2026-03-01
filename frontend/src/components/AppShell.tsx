"use client";

interface Props {
  topic?: string;
  showTopBar: boolean;
  activeYear?: string | null;
  activePhase?: string | null;
  children: React.ReactNode;
}

export function AppShell({ topic, showTopBar, activeYear, activePhase, children }: Props) {
  return (
    <div className="min-h-screen bg-chrono-bg">
      {showTopBar && (
        <header className="sticky top-0 z-40 flex h-12 items-center border-b border-chrono-border/50 bg-chrono-bg/80 px-6 backdrop-blur-md">
          <span className="text-chrono-caption font-semibold tracking-wider text-chrono-text-muted">
            Chrono
          </span>
          {topic && (
            <span className="ml-4 text-chrono-caption text-chrono-text-secondary">
              {topic}
            </span>
          )}
          {(activeYear || activePhase) && (
            <div className="ml-auto flex items-center gap-3 text-chrono-caption text-chrono-text-muted">
              {activePhase && <span>{activePhase}</span>}
              {activeYear && <span>{activeYear}</span>}
            </div>
          )}
        </header>
      )}
      {children}
    </div>
  );
}
