"use client";

interface SkeletonNodeProps {
  side: "left" | "right";
}

export default function SkeletonNode({ side }: SkeletonNodeProps) {
  return (
    <div className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-4 mb-5">
      <div className="flex justify-end pr-4">
        {side === "left" && (
          <div className="w-full max-w-[440px] rounded-lg border border-chrono-border/30 bg-chrono-surface/30 p-4">
            <div className="shimmer h-3 w-24 rounded mb-3" />
            <div className="shimmer h-4 w-3/4 rounded mb-2" />
            <div className="shimmer h-3 w-full rounded mb-1.5" />
            <div className="shimmer h-3 w-2/3 rounded" />
          </div>
        )}
      </div>
      <div className="flex items-center justify-center w-6">
        <span className="h-2 w-2 rounded-full bg-chrono-border animate-pulse ring-4 ring-chrono-bg" />
      </div>
      <div className="flex justify-start pl-4">
        {side === "right" && (
          <div className="w-full max-w-[440px] rounded-lg border border-chrono-border/30 bg-chrono-surface/30 p-4">
            <div className="flex items-center gap-2 mb-2.5">
              <div className="shimmer h-3 w-20 rounded" />
              <span className="text-chrono-tiny text-chrono-accent/70 italic">enriching…</span>
            </div>
            <div className="shimmer h-4 w-2/3 rounded mb-2" />
            <div className="shimmer h-3 w-full rounded" />
          </div>
        )}
      </div>
    </div>
  );
}
