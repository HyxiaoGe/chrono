"use client";

import { useEffect, useState, useCallback } from "react";
import { ExternalLink } from "lucide-react";
import type { TimelineNode } from "@/types";
import type { ConnectionMap } from "@/hooks/useConnections";
import { connectionTypeColor } from "./TimelineNode";
import { tagLabel } from "@/utils/tags";

function formatSourceUrl(url: string): { display: string; domain: string } {
  try {
    const u = new URL(url);
    const domain = u.hostname.replace(/^www\./, "");
    const path = u.pathname.length > 1 ? u.pathname.slice(1) : "";
    const decoded = decodeURIComponent(path);
    const short = decoded.length > 40 ? decoded.slice(0, 37) + "…" : decoded;
    return { display: short ? `${domain} › ${short}` : domain, domain };
  } catch {
    return { display: url, domain: "" };
  }
}

const LABELS: Record<string, Record<string, string>> = {
  key_features: { zh: "关键特性", en: "Key Features" },
  impact: { zh: "影响", en: "Impact" },
  key_people: { zh: "关键人物", en: "Key People" },
  context: { zh: "背景", en: "Context" },
  sources: { zh: "来源", en: "Sources" },
  connections: { zh: "因果关联", en: "Connections" },
  key_stats: { zh: "关键数据", en: "Key Stats" },
  description: { zh: "概述", en: "Overview" },
  notable_quote: { zh: "引言", en: "Quote" },
  // significance
  revolutionary: { zh: "突破", en: "revolutionary" },
  high: { zh: "重要", en: "high" },
  medium: { zh: "一般", en: "medium" },
  // connection types
  caused: { zh: "直接导致", en: "caused" },
  enabled: { zh: "促成", en: "enabled" },
  inspired: { zh: "启发", en: "inspired" },
  responded_to: { zh: "回应", en: "responded to" },
};

function label(key: string, language: string): string {
  const entry = LABELS[key];
  if (!entry) return key;
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
  const isZh = language.startsWith("zh");
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
        className={`relative flex h-full w-full max-w-[420px] flex-col border-l border-chrono-border bg-chrono-bg/95 backdrop-blur-md ${
          closing ? "animate-slide-out-right" : "animate-slide-in-right"
        }`}
      >
        {/* Header */}
        <div className="shrink-0 border-b border-chrono-border bg-chrono-bg/90 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
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
                {label(sig, language)}
              </span>
            </div>
            <button
              onClick={startClose}
              className="shrink-0 ml-2 flex h-7 w-7 items-center justify-center rounded-md text-chrono-text-muted transition-colors hover:bg-chrono-surface hover:text-chrono-text"
            >
              &times;
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
        <div className="space-y-6 px-6 py-6">
          {/* Title + subtitle + tags */}
          <div>
            <h2
              className={`font-bold leading-tight ${
                sig === "revolutionary"
                  ? "text-2xl text-chrono-revolutionary"
                  : "text-chrono-title text-chrono-text"
              }`}
            >
              {displayNode.title}
            </h2>
            {displayNode.subtitle && (
              <p className="mt-1.5 text-chrono-caption italic text-chrono-text-secondary">
                {displayNode.subtitle}
              </p>
            )}
            {details?.location && (
              <p className="mt-1 text-chrono-tiny text-chrono-text-muted">
                {isZh ? "地点：" : "Location: "}{details.location}
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
          {(() => {
            const cleanQuote =
              details?.notable_quote?.replace(/^["'\\]+$/, "").trim() || "";
            return cleanQuote ? (
              <div className="relative pl-5 py-1">
                <span className="absolute left-0 top-0 text-3xl leading-none text-chrono-accent/40 font-serif select-none" aria-hidden>
                  &ldquo;
                </span>
                <p className="text-base italic leading-relaxed text-chrono-text-secondary">
                  {cleanQuote}
                </p>
              </div>
            ) : null;
          })()}

          <DetailSection title={label("description", language)}>
            <p className="text-chrono-body leading-relaxed text-chrono-text-secondary">
              {displayNode.description}
            </p>
          </DetailSection>

          {details ? (
            <>
              {/* Key Stats */}
              {details.key_stats && details.key_stats.length > 0 && (
                <DetailSection title={label("key_stats", language)}>
                  <ul className="space-y-2">
                    {details.key_stats.map((stat, i) => (
                      <li
                        key={i}
                        className="flex items-baseline gap-2 rounded-lg bg-chrono-surface/50 px-3 py-2 border border-chrono-border/30"
                      >
                        <span className="shrink-0 mt-1 h-1.5 w-1.5 rounded-full bg-chrono-accent" />
                        <span className="text-chrono-caption text-chrono-text-secondary">
                          {stat}
                        </span>
                      </li>
                    ))}
                  </ul>
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
                    {details.key_people.map((p, i) => {
                      const sep = p.match(/^(.+?)\s*[——\-–—:：]\s*(.+)$/);
                      const name = sep ? sep[1].trim() : p;
                      const role = sep ? sep[2].trim() : "";
                      const initial = name.charAt(0).toUpperCase();
                      return (
                        <div
                          key={i}
                          className="flex items-center gap-2 rounded-lg border border-chrono-border/30 bg-chrono-surface/50 px-2.5 py-2"
                        >
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-chrono-accent/15 text-[10px] font-bold text-chrono-accent">
                            {initial}
                          </div>
                          <div className="min-w-0">
                            <div className="text-chrono-tiny font-semibold text-chrono-text leading-tight">
                              {name}
                            </div>
                            {role && (
                              <div className="text-chrono-tiny text-chrono-text-muted leading-tight">
                                {role}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
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
                  <div className="space-y-3">
                    {connInfo.outgoing.length > 0 && (
                      <div>
                        <div className="mb-1.5 text-chrono-tiny text-chrono-text-muted/60">
                          {isZh ? "→ 影响了" : "→ Led to"}
                        </div>
                        <div className="space-y-1">
                          {connInfo.outgoing.map((conn, i) => (
                            <button
                              key={`out-${i}`}
                              onClick={() => onNavigateToNode(conn.targetId)}
                              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-chrono-surface-hover"
                              title={conn.relationship}
                            >
                              <span className="min-w-0 flex-1 text-chrono-caption text-chrono-text-secondary">
                                <span className="truncate">{conn.targetTitle}</span>
                                {conn.relationship && (
                                  <span className="mt-0.5 block truncate text-chrono-tiny text-chrono-text-muted/50">
                                    {conn.relationship}
                                  </span>
                                )}
                              </span>
                              <span
                                className={`shrink-0 rounded-full px-1.5 py-0.5 text-chrono-tiny ${connectionTypeColor(conn.type)}`}
                              >
                                {label(conn.type, language)}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {connInfo.incoming.length > 0 && (
                      <div>
                        <div className="mb-1.5 text-chrono-tiny text-chrono-text-muted/60">
                          {isZh ? "← 受影响于" : "← Influenced by"}
                        </div>
                        <div className="space-y-1">
                          {connInfo.incoming.map((conn, i) => (
                            <button
                              key={`in-${i}`}
                              onClick={() => onNavigateToNode(conn.sourceId)}
                              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-chrono-surface-hover"
                              title={conn.relationship}
                            >
                              <span className="min-w-0 flex-1 text-chrono-caption text-chrono-text-secondary">
                                <span className="truncate">{conn.sourceTitle}</span>
                                {conn.relationship && (
                                  <span className="mt-0.5 block truncate text-chrono-tiny text-chrono-text-muted/50">
                                    {conn.relationship}
                                  </span>
                                )}
                              </span>
                              <span
                                className={`shrink-0 rounded-full px-1.5 py-0.5 text-chrono-tiny ${connectionTypeColor(conn.type)}`}
                              >
                                {label(conn.type, language)}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </DetailSection>
              )}

              {displayNode.sources.length > 0 && (
                <DetailSection title={label("sources", language)}>
                  <ul className="space-y-1.5">
                    {displayNode.sources.map((url, i) => {
                      const { display, domain } = formatSourceUrl(url);
                      return (
                        <li key={i}>
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 rounded-md px-2 py-1 text-chrono-tiny transition-colors hover:bg-chrono-surface-hover group/source"
                          >
                            {domain && (
                              <img
                                src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
                                alt=""
                                width={14}
                                height={14}
                                className="shrink-0 rounded-sm"
                              />
                            )}
                            <span className="min-w-0 flex-1 truncate text-chrono-text-muted group-hover/source:text-chrono-text-secondary">
                              {domain && (
                                <span className="text-chrono-text-secondary">{domain.split("/")[0]}</span>
                              )}
                              {display.includes("›") && (
                                <span className="text-chrono-text-muted"> › {display.split("›")[1]?.trim()}</span>
                              )}
                              {!display.includes("›") && !domain && display}
                            </span>
                            <ExternalLink size={12} className="shrink-0 text-chrono-text-muted group-hover/source:text-chrono-text-secondary" />
                          </a>
                        </li>
                      );
                    })}
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
      <h4 className="mb-2 text-chrono-tiny font-medium text-chrono-text-muted/70">
        {title}
      </h4>
      {children}
    </div>
  );
}
