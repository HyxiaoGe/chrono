"use client";

import { useEffect, useState, useCallback } from "react";
import type { TimelineNode } from "@/types";
import type { ConnectionMap } from "@/hooks/useConnections";
import { connectionTypeColor } from "./TimelineNode";

const LABELS: Record<string, Record<string, string>> = {
  key_features: { zh: "关键特性", en: "Key Features" },
  impact: { zh: "影响", en: "Impact" },
  key_people: { zh: "关键人物", en: "Key People" },
  context: { zh: "背景", en: "Context" },
  sources: { zh: "来源", en: "Sources" },
  connections: { zh: "因果关联", en: "Connections" },
  key_stats: { zh: "关键数据", en: "Key Stats" },
};

const TAG_DISPLAY: Record<string, Record<string, string>> = {
  product_launch: { en: "Product Launch", zh: "产品发布" },
  hardware: { en: "Hardware", zh: "硬件" },
  software: { en: "Software", zh: "软件" },
  business: { en: "Business", zh: "商业" },
  policy: { en: "Policy", zh: "政策" },
  milestone: { en: "Milestone", zh: "里程碑" },
  innovation: { en: "Innovation", zh: "创新" },
  partnership: { en: "Partnership", zh: "合作" },
  acquisition: { en: "Acquisition", zh: "收购" },
  regulation: { en: "Regulation", zh: "监管" },
  cultural_shift: { en: "Cultural", zh: "文化" },
  scientific: { en: "Scientific", zh: "科学" },
  military: { en: "Military", zh: "军事" },
  diplomatic: { en: "Diplomatic", zh: "外交" },
  security: { en: "Security", zh: "安全" },
  technological_shift: { en: "Tech Shift", zh: "技术变革" },
};

function label(key: string, language: string): string {
  const entry = LABELS[key];
  if (!entry) return key;
  if (language.startsWith("zh")) return entry.zh;
  return entry.en;
}

function tagLabel(tag: string, language: string): string {
  const entry = TAG_DISPLAY[tag];
  if (!entry) return tag;
  if (language.startsWith("zh")) return entry.zh;
  return entry.en;
}

interface Props {
  node: TimelineNode | null;
  language: string;
  connectionMap: ConnectionMap;
  onClose: () => void;
  onNavigateToNode: (targetId: string) => void;
}

export function DetailPanel({
  node,
  language,
  connectionMap,
  onClose,
  onNavigateToNode,
}: Props) {
  const [closing, setClosing] = useState(false);
  const [closingNode, setClosingNode] = useState<TimelineNode | null>(null);

  const displayNode = closing ? closingNode : node;

  const startClose = useCallback(() => {
    setClosingNode(node);
    setClosing(true);
  }, [node]);

  useEffect(() => {
    if (!closing) return;
    const timer = setTimeout(() => {
      setClosing(false);
      setClosingNode(null);
      onClose();
    }, 250);
    return () => clearTimeout(timer);
  }, [closing, onClose]);

  useEffect(() => {
    if (!displayNode) return;
    document.body.style.overflow = "hidden";
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") startClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [displayNode, startClose]);

  if (!displayNode) return null;

  const sig = displayNode.significance;
  const details = displayNode.details;
  const connInfo = connectionMap.get(displayNode.id);
  const hasConnections =
    connInfo &&
    (connInfo.outgoing.length > 0 || connInfo.incoming.length > 0);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className={`absolute inset-0 bg-black/40 transition-opacity duration-250 ${
          closing ? "opacity-0" : "opacity-100"
        }`}
        onClick={startClose}
      />

      <div
        className={`relative w-full max-w-[420px] overflow-y-auto border-l border-chrono-border bg-chrono-bg/95 backdrop-blur-md ${
          closing ? "animate-slide-out-right" : "animate-slide-in-right"
        }`}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-chrono-border bg-chrono-bg/90 px-6 py-4 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <span className="text-chrono-caption text-chrono-text-muted">
              {displayNode.date}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-chrono-tiny font-medium ${
                sig === "revolutionary"
                  ? "bg-chrono-revolutionary/15 text-chrono-revolutionary"
                  : sig === "high"
                    ? "bg-chrono-high/15 text-chrono-high"
                    : "bg-chrono-medium/15 text-chrono-text-muted"
              }`}
            >
              {sig}
            </span>
            {details?.location && (
              <span className="text-chrono-tiny text-chrono-text-muted">
                {details.location}
              </span>
            )}
          </div>
          <button
            onClick={startClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-chrono-text-muted transition-colors hover:bg-chrono-surface hover:text-chrono-text"
          >
            &times;
          </button>
        </div>

        <div className="space-y-6 px-6 py-6">
          {/* Title + subtitle + tags */}
          <div>
            <h2
              className={`text-chrono-title font-semibold ${
                sig === "revolutionary"
                  ? "text-chrono-revolutionary"
                  : "text-chrono-text"
              }`}
            >
              {displayNode.title}
            </h2>
            {displayNode.subtitle && (
              <p className="mt-1 text-chrono-caption text-chrono-text-secondary">
                {displayNode.subtitle}
              </p>
            )}
            {details?.tags && details.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {details.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-chrono-accent/10 px-2 py-0.5 text-chrono-tiny text-chrono-accent"
                  >
                    {tagLabel(tag, language)}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Notable quote */}
          {details?.notable_quote && (
            <blockquote className="border-l-2 border-chrono-accent/50 pl-4 py-2">
              <p className="text-chrono-body italic text-chrono-text-secondary">
                {details.notable_quote}
              </p>
            </blockquote>
          )}

          <p className="text-chrono-body leading-relaxed text-chrono-text-secondary">
            {displayNode.description}
          </p>

          {details ? (
            <>
              {/* Key Stats */}
              {details.key_stats && details.key_stats.length > 0 && (
                <DetailSection title={label("key_stats", language)}>
                  <div className="grid grid-cols-2 gap-2">
                    {details.key_stats.map((stat, i) => (
                      <div
                        key={i}
                        className="rounded-lg bg-chrono-surface p-3 border border-chrono-border/50"
                      >
                        <span className="text-chrono-caption text-chrono-text-secondary">
                          {stat}
                        </span>
                      </div>
                    ))}
                  </div>
                </DetailSection>
              )}

              <DetailSection title={label("key_features", language)}>
                <ul className="space-y-1.5">
                  {details.key_features.map((f, i) => (
                    <li
                      key={i}
                      className="text-chrono-body text-chrono-text-secondary"
                    >
                      <span className="mr-2 text-chrono-text-muted">
                        &bull;
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
              </DetailSection>

              <DetailSection title={label("impact", language)}>
                <p className="text-chrono-body text-chrono-text-secondary">
                  {details.impact}
                </p>
              </DetailSection>

              {details.key_people.length > 0 && (
                <DetailSection title={label("key_people", language)}>
                  <div className="flex flex-wrap gap-2">
                    {details.key_people.map((p, i) => (
                      <span
                        key={i}
                        className="rounded-full border border-chrono-border px-2.5 py-0.5 text-chrono-caption text-chrono-text-secondary"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                </DetailSection>
              )}

              <DetailSection title={label("context", language)}>
                <p className="text-chrono-body text-chrono-text-secondary">
                  {details.context}
                </p>
              </DetailSection>

              {hasConnections && (
                <DetailSection title={label("connections", language)}>
                  <div className="space-y-2">
                    {connInfo.outgoing.map((conn, i) => (
                      <button
                        key={`out-${i}`}
                        onClick={() => onNavigateToNode(conn.targetId)}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-chrono-surface-hover"
                      >
                        <span className="text-chrono-tiny text-chrono-text-muted">
                          →
                        </span>
                        <span className="min-w-0 flex-1 truncate text-chrono-caption text-chrono-text-secondary">
                          {conn.targetTitle}
                        </span>
                        <span
                          className={`shrink-0 rounded-full px-1.5 py-0.5 text-chrono-tiny ${connectionTypeColor(conn.type)}`}
                        >
                          {conn.type}
                        </span>
                      </button>
                    ))}
                    {connInfo.incoming.map((conn, i) => (
                      <button
                        key={`in-${i}`}
                        onClick={() => onNavigateToNode(conn.sourceId)}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-chrono-surface-hover"
                      >
                        <span className="text-chrono-tiny text-chrono-text-muted">
                          ←
                        </span>
                        <span className="min-w-0 flex-1 truncate text-chrono-caption text-chrono-text-secondary">
                          {conn.sourceTitle}
                        </span>
                        <span
                          className={`shrink-0 rounded-full px-1.5 py-0.5 text-chrono-tiny ${connectionTypeColor(conn.type)}`}
                        >
                          {conn.type}
                        </span>
                      </button>
                    ))}
                  </div>
                </DetailSection>
              )}

              {displayNode.sources.length > 0 && (
                <DetailSection title={label("sources", language)}>
                  <ul className="space-y-1">
                    {displayNode.sources.map((url, i) => (
                      <li key={i}>
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block truncate text-chrono-tiny text-chrono-text-muted transition-colors hover:text-chrono-text-secondary"
                        >
                          {url}
                        </a>
                      </li>
                    ))}
                  </ul>
                </DetailSection>
              )}
            </>
          ) : (
            <div className="space-y-3 pt-2">
              <div className="shimmer h-3 w-full rounded" />
              <div className="shimmer h-3 w-4/5 rounded" />
              <div className="shimmer h-3 w-3/5 rounded" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h4 className="mb-2 text-chrono-tiny font-medium uppercase tracking-wider text-chrono-text-muted">
        {title}
      </h4>
      {children}
    </div>
  );
}
