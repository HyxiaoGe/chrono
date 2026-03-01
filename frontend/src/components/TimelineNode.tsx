"use client";

import type { TimelineNode } from "@/types";

interface Props {
  node: TimelineNode;
  isSelected: boolean;
  isHighlighted: boolean;
  connectionCount: number;
  onSelect: (id: string) => void;
  language: string;
}

const CONNECTION_TYPE_COLORS: Record<string, string> = {
  caused: "bg-chrono-caused/15 text-chrono-caused",
  enabled: "bg-chrono-enabled/15 text-chrono-enabled",
  inspired: "bg-chrono-inspired/15 text-chrono-inspired",
  responded_to: "bg-chrono-responded/15 text-chrono-responded",
};

export function connectionTypeColor(type: string): string {
  return CONNECTION_TYPE_COLORS[type] ?? "bg-chrono-border text-chrono-text-muted";
}

export function TimelineNodeCard({
  node,
  isSelected,
  isHighlighted,
  connectionCount,
  onSelect,
  language,
}: Props) {
  const isComplete = node.status === "complete";
  const sig = node.significance;
  const isZh = language.startsWith("zh");

  const highlightClass = isHighlighted ? "animate-highlight" : "";
  const selectedClass = isSelected ? "ring-2 ring-chrono-accent/40" : "";

  if (!isComplete) {
    return <SkeletonCard node={node} sig={sig} />;
  }

  const badge =
    connectionCount > 0 ? (
      <div className="mt-2 text-chrono-tiny text-chrono-text-muted opacity-0 transition-opacity group-hover:opacity-100">
        {"◈ "}
        {connectionCount} {isZh ? "个关联" : "connections"}
      </div>
    ) : null;

  if (sig === "revolutionary") {
    return (
      <div
        className={`group animate-fade-in cursor-pointer rounded-xl border-l-4 border-chrono-revolutionary bg-chrono-surface-hover p-6 shadow-md shadow-chrono-revolutionary/10 transition-all ${selectedClass} ${highlightClass}`}
        onClick={() => onSelect(node.id)}
      >
        <h3 className="text-chrono-subtitle font-semibold text-chrono-revolutionary">
          {node.title}
        </h3>
        {node.subtitle && (
          <p className="mt-0.5 text-chrono-caption text-chrono-text-secondary">
            {node.subtitle}
          </p>
        )}
        <p className="mt-2 text-chrono-body text-chrono-text-secondary">
          {node.description}
        </p>
        {badge}
      </div>
    );
  }

  if (sig === "high") {
    return (
      <div
        className={`group animate-fade-in cursor-pointer rounded-xl border border-chrono-border bg-chrono-surface p-5 transition-all hover:border-chrono-border-active ${selectedClass} ${highlightClass}`}
        onClick={() => onSelect(node.id)}
      >
        <h3 className="font-semibold text-chrono-text">{node.title}</h3>
        <p className="mt-1.5 text-chrono-body text-chrono-text-secondary line-clamp-2">
          {node.description}
        </p>
        {badge}
      </div>
    );
  }

  // medium — borderless text row
  return (
    <div
      className={`group animate-fade-in cursor-pointer px-4 py-2 transition-all hover:bg-chrono-surface/50 ${selectedClass} ${highlightClass}`}
      onClick={() => onSelect(node.id)}
    >
      <h3 className="font-medium text-chrono-text-secondary">{node.title}</h3>
      <p className="mt-0.5 text-chrono-caption text-chrono-text-muted line-clamp-1">
        {node.description}
      </p>
      {badge}
    </div>
  );
}

function SkeletonCard({ node, sig }: { node: TimelineNode; sig: string }) {
  const isRev = sig === "revolutionary";
  if (isRev) {
    return (
      <div className="rounded-xl border-l-4 border-chrono-revolutionary bg-chrono-surface-hover p-6">
        <div className="font-semibold text-chrono-text">{node.title}</div>
        <div className="mt-3 space-y-2">
          <div className="shimmer h-3 w-full rounded" />
          <div className="shimmer h-3 w-4/5 rounded" />
          <div className="shimmer h-3 w-3/5 rounded" />
        </div>
      </div>
    );
  }
  if (sig === "high") {
    return (
      <div className="rounded-xl border border-chrono-border bg-chrono-surface p-5">
        <div className="font-semibold text-chrono-text">{node.title}</div>
        <div className="mt-3 space-y-2">
          <div className="shimmer h-3 w-full rounded" />
          <div className="shimmer h-3 w-4/5 rounded" />
          <div className="shimmer h-3 w-3/5 rounded" />
        </div>
      </div>
    );
  }
  // medium skeleton — no border/bg
  return (
    <div className="px-4 py-2">
      <div className="font-medium text-chrono-text-secondary">{node.title}</div>
      <div className="mt-2 space-y-2">
        <div className="shimmer h-3 w-full rounded" />
        <div className="shimmer h-3 w-3/5 rounded" />
      </div>
    </div>
  );
}
