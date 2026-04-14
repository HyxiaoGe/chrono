"use client";

import type { TimelineNode, NodeProgressData } from "@/types";
import { tagLabel } from "@/utils/tags";

interface Props {
  node: TimelineNode;
  isSelected: boolean;
  isHighlighted: boolean;
  isDimmed: boolean;
  connectionCount: number;
  onSelect: (id: string) => void;
  language: string;
  progress?: NodeProgressData;
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
  isDimmed,
  connectionCount,
  onSelect,
  language,
  progress,
}: Props) {
  const isComplete = node.status === "complete";
  const sig = node.significance;
  const isZh = language.startsWith("zh");

  const highlightClass = isHighlighted ? "animate-highlight" : "";
  const selectedClass = isSelected ? "ring-2 ring-chrono-accent/40" : "";
  const dimClass = isDimmed ? "opacity-40" : "";

  if (!isComplete) {
    return <SkeletonCard node={node} sig={sig} progress={progress} isZh={isZh} />;
  }

  const details = node.details;

  const meta =
    details && (details.location || (details.tags && details.tags.length > 0)) ? (
      <div className="flex flex-wrap items-center gap-2">
        {details.location && (
          <span className="text-chrono-tiny text-chrono-text-muted">
            {details.location}
          </span>
        )}
        {details.tags?.slice(0, 2).map((tag) => (
          <span
            key={tag}
            className="rounded-full bg-chrono-accent/10 px-1.5 py-0.5 text-chrono-tiny text-chrono-accent"
          >
            {tagLabel(tag, language)}
          </span>
        ))}
      </div>
    ) : null;

  const badge =
    connectionCount > 0 ? (
      <span className="inline-flex items-center gap-1 text-chrono-tiny text-chrono-text-muted/60">
        <span className="text-chrono-accent/50">◈</span>
        {connectionCount} {isZh ? "关联" : connectionCount > 1 ? "connections" : "connection"}
      </span>
    ) : null;

  if (sig === "revolutionary") {
    return (
      <div
        className={`group animate-fade-in cursor-pointer rounded-xl border border-chrono-revolutionary/50 bg-gradient-to-br from-chrono-revolutionary/5 to-chrono-surface-hover p-6 transition-all hover:border-chrono-revolutionary/80 hover:shadow-lg hover:shadow-chrono-revolutionary/10 ${selectedClass} ${highlightClass} ${dimClass}`}
        onClick={() => onSelect(node.id)}
      >
        <div className="mb-2 flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-chrono-revolutionary/60">
            {isZh ? "重大事件" : "Landmark"}
          </span>
          <div className="h-px flex-1 bg-chrono-revolutionary/15" />
        </div>
        <h3 className="text-xl font-bold leading-tight text-chrono-revolutionary">
          {node.title}
        </h3>
        {node.subtitle && (
          <p className="mt-1 text-chrono-caption italic text-chrono-text-secondary">
            {node.subtitle}
          </p>
        )}
        <p className="mt-2 text-chrono-body text-chrono-text-secondary">
          {node.description}
        </p>
        {(meta || badge) && (
          <div className="mt-3 flex items-center gap-3">
            {meta}
            {badge && <span className="ml-auto">{badge}</span>}
          </div>
        )}
      </div>
    );
  }

  if (sig === "high") {
    return (
      <div
        className={`group animate-fade-in cursor-pointer rounded-xl border border-chrono-border bg-chrono-surface p-5 transition-all hover:border-chrono-border-active ${selectedClass} ${highlightClass} ${dimClass}`}
        onClick={() => onSelect(node.id)}
      >
        <h3 className="font-semibold text-chrono-text">{node.title}</h3>
        <p className="mt-1.5 text-chrono-body text-chrono-text-secondary line-clamp-2">
          {node.description}
        </p>
        {(meta || badge) && (
          <div className="mt-2 flex items-center gap-3">
            {meta}
            {badge && <span className="ml-auto">{badge}</span>}
          </div>
        )}
      </div>
    );
  }

  // medium
  return (
    <div
      className={`group animate-fade-in cursor-pointer rounded-lg border-l-2 border-chrono-medium/30 px-4 py-2 transition-all hover:bg-chrono-surface/50 ${selectedClass} ${highlightClass} ${dimClass}`}
      onClick={() => onSelect(node.id)}
    >
      <h3 className="font-medium text-chrono-text-secondary">{node.title}</h3>
      <p className="mt-0.5 text-chrono-caption text-chrono-text-muted line-clamp-1">
        {node.description}
      </p>
      {(meta || badge) && (
        <div className="mt-1 flex items-center gap-3">
          {meta}
          {badge && <span className="ml-auto">{badge}</span>}
        </div>
      )}
    </div>
  );
}

function ActiveIndicator({
  progress,
  isZh,
}: {
  progress: NodeProgressData;
  isZh: boolean;
}) {
  const stepText = progress.step === "searching"
    ? (isZh ? "搜索中..." : "searching...")
    : progress.step === "analyzing"
      ? (isZh ? "分析中..." : "analyzing...")
      : (isZh ? "生成中..." : "generating...");
  return (
    <div className="mt-3 flex items-center gap-3">
      {/* Radiating pulse dot */}
      <span className="relative flex h-3 w-3 items-center justify-center">
        <span
          className="absolute h-3 w-3 rounded-full bg-chrono-accent/30"
          style={{ animation: "ripple 1.5s ease-out infinite" }}
        />
        <span
          className="absolute h-3 w-3 rounded-full bg-chrono-accent/20"
          style={{ animation: "ripple 1.5s ease-out 0.5s infinite" }}
        />
        <span
          className="absolute h-3 w-3 rounded-full bg-chrono-accent/10"
          style={{ animation: "ripple 1.5s ease-out 1s infinite" }}
        />
        <span
          className="relative h-2 w-2 rounded-full bg-chrono-accent"
          style={{ animation: "glow-pulse 2s ease-in-out infinite" }}
        />
      </span>
      <span className="text-chrono-tiny font-medium text-chrono-accent">
        {progress.model}
      </span>
      <span className="text-chrono-tiny text-chrono-text-muted">
        {stepText}
      </span>
    </div>
  );
}

function SkeletonCard({
  node,
  sig,
  progress,
  isZh,
}: {
  node: TimelineNode;
  sig: string;
  progress?: NodeProgressData;
  isZh: boolean;
}) {
  const isActive = !!progress;
  const activeClass = isActive
    ? "border-chrono-accent/40"
    : "";
  const activeStyle = isActive
    ? { animation: "glow-pulse 2s ease-in-out infinite" }
    : undefined;

  if (sig === "revolutionary") {
    return (
      <div
        className={`rounded-xl border bg-chrono-surface-hover p-6 transition-all duration-300 ${isActive ? activeClass : "border-chrono-revolutionary/25"}`}
        style={activeStyle}
      >
        <div className="mb-2 flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-chrono-revolutionary/40">
            {isZh ? "重大事件" : "Landmark"}
          </span>
          <div className="h-px flex-1 bg-chrono-revolutionary/10" />
        </div>
        <div className={`text-xl font-bold leading-tight ${isActive ? "text-chrono-revolutionary/70" : "text-chrono-revolutionary/30"}`}>
          {node.title}
        </div>
        {isActive ? (
          <ActiveIndicator progress={progress} isZh={isZh} />
        ) : (
          <div className="mt-3 space-y-2">
            <div className="shimmer h-3 w-full rounded" />
            <div className="shimmer h-3 w-4/5 rounded" />
          </div>
        )}
      </div>
    );
  }

  if (sig === "high") {
    return (
      <div className={`rounded-xl border bg-chrono-surface/50 p-5 transition-all duration-300 ${isActive ? activeClass : "border-chrono-border/40"}`} style={activeStyle}>
        <div className={`font-semibold ${isActive ? "text-chrono-text" : "text-chrono-text/40"}`}>
          {node.title}
        </div>
        {isActive ? (
          <ActiveIndicator progress={progress} isZh={isZh} />
        ) : (
          <div className="mt-3 space-y-2">
            <div className="shimmer h-3 w-full rounded" />
            <div className="shimmer h-3 w-4/5 rounded" />
          </div>
        )}
      </div>
    );
  }

  // medium
  return (
    <div className={`rounded-lg px-4 py-2 transition-all duration-300 ${isActive ? "border border-chrono-accent/30" : ""}`} style={activeStyle}>
      <div className={`font-medium ${isActive ? "text-chrono-text-secondary" : "text-chrono-text-muted/40"}`}>
        {node.title}
      </div>
      {isActive ? (
        <ActiveIndicator progress={progress} isZh={isZh} />
      ) : (
        <div className="mt-2 space-y-2">
          <div className="shimmer h-3 w-full rounded" />
          <div className="shimmer h-3 w-3/5 rounded" />
        </div>
      )}
    </div>
  );
}
