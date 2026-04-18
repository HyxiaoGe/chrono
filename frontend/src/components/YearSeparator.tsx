"use client";

interface YearSeparatorProps {
  year: number;
  era?: string | null;
}

export default function YearSeparator({ year, era }: YearSeparatorProps) {
  return (
    <div className="relative my-6 flex items-center">
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-chrono-border/60 to-transparent" />
      <div className="mx-4 flex items-center gap-2">
        <span className="text-chrono-title font-semibold text-chrono-text/80 font-mono tabular-nums">
          {year}
        </span>
        {era && (
          <span className="text-chrono-tiny uppercase tracking-[0.15em] text-chrono-text-muted/70">
            {era}
          </span>
        )}
      </div>
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-chrono-border/60 to-transparent" />
    </div>
  );
}
