"use client";

import type { TimelineNode } from "@/types";

interface Props {
  node: TimelineNode;
  isSelected: boolean;
  isHighlighted: boolean;
  isSearchMatch: boolean;
  isCurrentMatch: boolean;
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
  isSearchMatch,
  isCurrentMatch,
  connectionCount,
  onSelect,
  language,
}: Props) {
  const isComplete = node.status === "complete";
  const sig = node.significance;
  const isZh = language.startsWith("zh");

  const highlightClass = isHighlighted ? "animate-highlight" : "";
  const selectedClass = isSelected ? "ring-2 ring-chrono-accent/40" : "";
  const currentMatchClass = isCurrentMatch
    ? "ring-2 ring-chrono-accent/60"
    : "";

  if (!isComplete) {
    return <SkeletonCard node={node} sig={sig} />;
  }

  const badge =
    connectionCount > 0 ? (
      <div className="mt-2 text-chrono-tiny text-chrono-text-muted">
        {"◈ "}
        {connectionCount} {isZh ? "个关联" : "connections"}
      </div>
    ) : null;

  if (sig === "revolutionary") {
    const searchClass =
      isSearchMatch && !isCurrentMatch ? "ring-1 ring-chrono-accent/40" : "";
    return (
      <div
        className={`animate-fade-in cursor-pointer rounded-xl border-l-4 border-chrono-revolutionary bg-chrono-surface p-6 shadow-lg shadow-chrono-revolutionary/5 transition-all ${selectedClass} ${highlightClass} ${currentMatchClass} ${searchClass}`}
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

  const searchBorder =
    isSearchMatch && !isCurrentMatch ? "border-l-2 border-l-chrono-accent" : "";

  if (sig === "high") {
    return (
      <div
        className={`animate-fade-in cursor-pointer rounded-xl border border-chrono-border bg-chrono-surface p-5 transition-all hover:border-chrono-border-active ${selectedClass} ${highlightClass} ${currentMatchClass} ${searchBorder}`}
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

  return (
    <div
      className={`animate-fade-in cursor-pointer rounded-lg border border-chrono-border bg-chrono-surface px-4 py-3 transition-all hover:border-chrono-border-active ${selectedClass} ${highlightClass} ${currentMatchClass} ${searchBorder}`}
      onClick={() => onSelect(node.id)}
    >
      <h3 className="font-medium text-chrono-text">{node.title}</h3>
      <p className="mt-1 text-chrono-caption text-chrono-text-muted line-clamp-1">
        {node.description}
      </p>
      {badge}
    </div>
  );
}

function SkeletonCard({ node, sig }: { node: TimelineNode; sig: string }) {
  const isRev = sig === "revolutionary";
  const padding = isRev ? "p-6" : sig === "high" ? "p-5" : "px-4 py-3";
  const border = isRev
    ? "border-l-4 border-chrono-revolutionary"
    : "border border-chrono-border";
  return (
    <div className={`rounded-xl bg-chrono-surface ${border} ${padding}`}>
      <div className="font-semibold text-chrono-text">{node.title}</div>
      <div className="mt-3 space-y-2">
        <div className="shimmer h-3 w-full rounded" />
        <div className="shimmer h-3 w-4/5 rounded" />
        <div className="shimmer h-3 w-3/5 rounded" />
      </div>
    </div>
  );
}
