"use client";

import { TimelineNode } from "@/types";
import { sigColor } from "@/utils/design";

interface NodeCardProps {
  node: TimelineNode;
  isSelected: boolean;
  isRelated: boolean;
  dimmed: boolean;
  onClick: (id: string) => void;
  onHover: (id: string | null) => void;
  side: "left" | "right";
}

export default function NodeCard({
  node,
  isSelected,
  isRelated,
  dimmed,
  onClick,
  onHover,
  side,
}: NodeCardProps) {
  const sig = node.significance;
  const color = sigColor(sig);
  const base = "cursor-pointer transition-all duration-200";
  const relatedRing = isRelated && !isSelected ? "ring-1 ring-chrono-accent/30" : "";
  const selRing = isSelected ? "ring-2 ring-chrono-accent/60" : "";

  const meta = (
    <div className="flex items-center gap-2 text-chrono-tiny text-chrono-text-muted font-mono tabular-nums mb-1.5">
      <span>{node.date}</span>
      {node.subtitle && (
        <>
          <span className="text-chrono-border">·</span>
          <span className="text-chrono-text-secondary font-sans">{node.subtitle}</span>
        </>
      )}
    </div>
  );

  const tags = node.details?.tags && node.details.tags.length > 0 && (
    <div className="mt-2.5 flex flex-wrap gap-1">
      {node.details.tags.slice(0, 4).map((t) => (
        <span
          key={t}
          className="rounded-full border border-chrono-border/40 bg-chrono-bg/40 px-2 py-0.5 text-chrono-tiny text-chrono-text-muted"
        >
          {t}
        </span>
      ))}
    </div>
  );

  if (sig === "revolutionary") {
    return (
      <div
        onClick={() => onClick(node.id)}
        onMouseEnter={() => onHover(node.id)}
        onMouseLeave={() => onHover(null)}
        data-node-id={node.id}
        className={`${base} ${relatedRing} ${selRing} rounded-xl border p-5 shadow-md`}
        style={{
          background: "linear-gradient(180deg, #27272a 0%, #18181b 100%)",
          borderColor: "rgba(240,192,96,0.5)",
          borderLeft: `3px solid ${color}`,
          boxShadow: "0 4px 12px -2px rgba(240,192,96,0.1)",
        }}
      >
        {meta}
        <h3 className="text-chrono-subtitle font-semibold text-chrono-revolutionary leading-tight">
          {node.title}
        </h3>
        <p className="mt-2 text-chrono-body text-chrono-text-secondary leading-relaxed">
          {node.description}
        </p>
        {tags}
      </div>
    );
  }

  if (sig === "high") {
    return (
      <div
        onClick={() => onClick(node.id)}
        onMouseEnter={() => onHover(node.id)}
        onMouseLeave={() => onHover(null)}
        data-node-id={node.id}
        className={`${base} ${relatedRing} ${selRing} rounded-lg border p-4`}
        style={{
          backgroundColor: "rgba(24,24,27,0.7)",
          borderColor: "rgba(63,63,70,0.6)",
          borderLeft: `3px solid ${color}`,
        }}
      >
        {meta}
        <h3 className="font-semibold text-chrono-text leading-snug">{node.title}</h3>
        <p className="mt-1.5 text-chrono-caption text-chrono-text-secondary leading-relaxed line-clamp-2">
          {node.description}
        </p>
        {tags}
      </div>
    );
  }

  // medium — compact
  return (
    <div
      onClick={() => onClick(node.id)}
      onMouseEnter={() => onHover(node.id)}
      onMouseLeave={() => onHover(null)}
      data-node-id={node.id}
      className={`${base} ${relatedRing} ${selRing} rounded-md px-3.5 py-2.5`}
      style={{
        backgroundColor: "rgba(24,24,27,0.3)",
        borderLeft: `2px solid ${color}80`,
      }}
    >
      <div className="flex items-center gap-2 text-chrono-tiny text-chrono-text-muted font-mono tabular-nums mb-0.5">
        <span>{node.date}</span>
      </div>
      <h3 className="text-chrono-caption font-medium text-chrono-text-secondary leading-snug">
        {node.title}
      </h3>
      <p className="mt-0.5 text-chrono-tiny text-chrono-text-muted line-clamp-1">
        {node.description}
      </p>
    </div>
  );
}
