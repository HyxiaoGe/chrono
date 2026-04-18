"use client";

interface CompletionBannerProps {
  nodeCount: number;
  timeStr: string;
}

export default function CompletionBanner({ nodeCount, timeStr }: CompletionBannerProps) {
  return (
    <div className="mb-6 flex items-center gap-3 rounded-lg border border-chrono-inspired/30 bg-chrono-inspired/[0.05] px-4 py-2.5">
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-chrono-inspired/20 text-chrono-inspired">
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </span>
      <span className="text-chrono-caption text-chrono-text-secondary">
        Research complete ·{" "}
        <span className="text-chrono-text font-mono tabular-nums">{nodeCount}</span> nodes ·{" "}
        <span className="text-chrono-text font-mono tabular-nums">{timeStr}</span>
      </span>
    </div>
  );
}
