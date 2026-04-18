"use client";

import React from "react";
import type { TimelineNode } from "@/types";
import type { ConnectionMap } from "@/hooks/useConnections";
import { Icon } from "@/components/ui/Icon";
import { Chip } from "@/components/ui/Chip";
import { sigColor, connColor } from "@/utils/design";
import { tagLabel } from "@/utils/tags";

/* ------------------------------------------------------------------ */
/*  Bilingual labels                                                   */
/* ------------------------------------------------------------------ */

const LABELS: Record<string, Record<string, string>> = {
  key_features: { zh: "关键特性", en: "Key Features" },
  impact: { zh: "影响", en: "Impact" },
  key_people: { zh: "关键人物", en: "Key People" },
  context: { zh: "背景", en: "Context" },
  sources: { zh: "来源", en: "Sources" },
  connections: { zh: "因果关联", en: "Related Nodes" },
  key_stats: { zh: "关键数据", en: "Key Stats" },
  description: { zh: "概述", en: "Overview" },
  notable_quote: { zh: "引言", en: "Quote" },
  tags: { zh: "标签", en: "Tags" },
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

/* ------------------------------------------------------------------ */
/*  Section helper                                                     */
/* ------------------------------------------------------------------ */

function Section({
  title,
  kicker,
  children,
}: {
  title: string;
  kicker?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2.5 flex items-center gap-2">
        <h4 className="text-chrono-tiny font-medium uppercase tracking-[0.12em] text-chrono-text-muted">
          {title}
        </h4>
        {kicker && (
          <span className="text-chrono-tiny text-chrono-text-muted/60 font-mono tabular-nums">
            {kicker}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface DetailPanelProps {
  node: TimelineNode | null;
  language: string;
  connectionMap: ConnectionMap;
  onClose: () => void;
  onNavigateToNode: (id: string) => void;
}

/* ------------------------------------------------------------------ */
/*  DetailPanel                                                        */
/* ------------------------------------------------------------------ */

export function DetailPanel({
  node,
  language,
  connectionMap,
  onClose,
  onNavigateToNode,
}: DetailPanelProps) {
  if (!node) return null;

  const details = node.details;
  const sig = node.significance;
  const sigTone =
    sig === "revolutionary" ? "revolutionary" : sig === "high" ? "high" : "mediumSig";
  const color = sigColor(sig);

  // Build related-nodes list from connectionMap
  const connInfo = connectionMap.get(node.id);
  const related: {
    nodeId: string;
    nodeTitle: string;
    nodeDate: string;
    type: string;
    direction: "out" | "in";
  }[] = [];
  if (connInfo) {
    for (const c of connInfo.outgoing) {
      related.push({
        nodeId: c.targetId,
        nodeTitle: c.targetTitle,
        nodeDate: "",
        type: c.type,
        direction: "out",
      });
    }
    for (const c of connInfo.incoming) {
      related.push({
        nodeId: c.sourceId,
        nodeTitle: c.sourceTitle,
        nodeDate: "",
        type: c.type,
        direction: "in",
      });
    }
  }

  return (
    <aside className="sticky top-20 w-[380px] shrink-0 self-start h-[calc(100vh-6rem)]">
      <div className="relative h-full flex flex-col rounded-xl border border-chrono-border/50 bg-chrono-surface/60 backdrop-blur-md overflow-hidden">
        {/* ---- Header ---- */}
        <div
          className="shrink-0 border-b border-chrono-border/40 px-5 py-4"
          style={{
            background: `linear-gradient(180deg, ${color}08 0%, transparent 100%)`,
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-chrono-tiny font-mono text-chrono-text-muted tabular-nums">
                  {node.date}
                </span>
                <Chip tone={sigTone}>{label(sig, language)}</Chip>
                {details?.location && (
                  <span className="inline-flex items-center gap-1 text-chrono-tiny text-chrono-text-muted">
                    <Icon name="pin" size={11} />
                    {details.location}
                  </span>
                )}
              </div>
              <h2
                className={`text-chrono-title font-semibold leading-tight ${
                  sig === "revolutionary"
                    ? "text-chrono-revolutionary"
                    : "text-chrono-text"
                }`}
              >
                {node.title}
              </h2>
              {node.subtitle && (
                <p className="mt-1 text-chrono-caption text-chrono-text-secondary">
                  {node.subtitle}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-chrono-text-muted hover:bg-chrono-surface hover:text-chrono-text transition-colors"
            >
              <Icon name="x" size={14} />
            </button>
          </div>
        </div>

        {/* ---- Scrollable body ---- */}
        <div className="flex-1 overflow-y-auto">
          <div className="space-y-6 px-5 py-5">
            {/* Description */}
            <p className="text-chrono-body leading-relaxed text-chrono-text-secondary">
              {node.description}
            </p>

            {/* Key stats (3-col grid) */}
            {details?.key_stats && details.key_stats.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {details.key_stats.map((stat, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-chrono-border/40 bg-chrono-bg/50 px-3 py-2.5"
                  >
                    <div className="text-chrono-body font-semibold text-chrono-text">
                      {stat}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Notable quote */}
            {details?.notable_quote && (
              <blockquote className="relative rounded-lg border-l-2 border-chrono-accent/60 bg-chrono-accent/[0.04] pl-4 pr-3 py-3">
                <p className="text-chrono-body italic text-chrono-text leading-relaxed">
                  &ldquo;{details.notable_quote}&rdquo;
                </p>
                {details.key_people && details.key_people[0] && (
                  <cite className="mt-1.5 block not-italic text-chrono-tiny text-chrono-text-muted">
                    &mdash; {details.key_people[0].split(" — ")[0]}
                  </cite>
                )}
              </blockquote>
            )}

            {/* Key features */}
            {details?.key_features && details.key_features.length > 0 && (
              <Section title={label("key_features", language)}>
                <ul className="space-y-1.5">
                  {details.key_features.map((f, i) => (
                    <li
                      key={i}
                      className="flex gap-2.5 text-chrono-caption text-chrono-text-secondary leading-relaxed"
                    >
                      <span
                        className="mt-1.5 h-1 w-1 shrink-0 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      {f}
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {/* Impact */}
            {details?.impact && (
              <Section title={label("impact", language)}>
                <p className="text-chrono-caption text-chrono-text-secondary leading-relaxed">
                  {details.impact}
                </p>
              </Section>
            )}

            {/* Key people */}
            {details?.key_people && details.key_people.length > 0 && (
              <Section title={label("key_people", language)}>
                <ul className="space-y-2">
                  {details.key_people.map((p, i) => {
                    const parts = p.split(" — ");
                    const initials = parts[0]
                      .split(" ")
                      .map((w) => w[0])
                      .slice(0, 2)
                      .join("");
                    return (
                      <li key={i} className="flex items-center gap-2.5">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-chrono-border/50 bg-chrono-bg/60 text-chrono-tiny font-medium text-chrono-text-secondary font-mono">
                          {initials}
                        </span>
                        <span className="text-chrono-caption">
                          <span className="font-medium text-chrono-text">
                            {parts[0]}
                          </span>
                          {parts[1] && (
                            <span className="text-chrono-text-muted">
                              {" "}
                              &mdash; {parts[1]}
                            </span>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </Section>
            )}

            {/* Tags */}
            {details?.tags && details.tags.length > 0 && (
              <Section title={label("tags", language)}>
                <div className="flex flex-wrap gap-1.5">
                  {details.tags.map((t) => (
                    <Chip key={t} tone="accent">
                      {tagLabel(t, language)}
                    </Chip>
                  ))}
                </div>
              </Section>
            )}

            {/* Related nodes */}
            {related.length > 0 && (
              <Section
                title={label("connections", language)}
                kicker={`${related.length}`}
              >
                <ul className="space-y-1.5">
                  {related.map((r, i) => (
                    <li key={i}>
                      <button
                        onClick={() => onNavigateToNode(r.nodeId)}
                        className="group flex w-full items-start gap-2.5 rounded-md border border-chrono-border/30 bg-chrono-bg/30 px-2.5 py-2 text-left hover:border-chrono-border/60 hover:bg-chrono-surface/50 transition-colors"
                      >
                        <span
                          className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ backgroundColor: connColor(r.type) }}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 text-chrono-tiny">
                            <span
                              className="font-medium"
                              style={{ color: connColor(r.type) }}
                            >
                              {r.direction === "out"
                                ? label(r.type, language)
                                : `\u2190 ${label(r.type, language)}`}
                            </span>
                          </div>
                          <div className="text-chrono-caption text-chrono-text group-hover:text-chrono-text truncate">
                            {r.nodeTitle}
                          </div>
                        </div>
                        <Icon
                          name="chevronRight"
                          size={12}
                          className="mt-1 text-chrono-text-muted opacity-0 group-hover:opacity-100 transition-opacity"
                        />
                      </button>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {/* Sources */}
            {node.sources && node.sources.length > 0 && (
              <Section
                title={label("sources", language)}
                kicker={`${node.sources.length}`}
              >
                <ul className="space-y-0.5">
                  {node.sources.map((url, i) => {
                    let domain: string;
                    let rest: string;
                    try {
                      const u = new URL(url);
                      domain = u.hostname.replace(/^www\./, "");
                      rest = u.pathname
                        .replace(/^\//, "")
                        .replace(/\/$/, "");
                    } catch {
                      domain = url;
                      rest = "";
                    }
                    return (
                      <li key={i}>
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group flex items-center gap-2 rounded-md px-2 py-1.5 text-chrono-tiny hover:bg-chrono-surface/70 transition-colors"
                        >
                          <span className="size-1.5 shrink-0 rounded-full bg-chrono-border" />
                          <span className="min-w-0 flex-1 truncate">
                            <span className="text-chrono-text-secondary">
                              {domain}
                            </span>
                            {rest && (
                              <span className="text-chrono-text-muted">
                                {" "}
                                &rsaquo;{" "}
                                {rest.slice(0, 36)}
                                {rest.length > 36 ? "\u2026" : ""}
                              </span>
                            )}
                          </span>
                          <Icon
                            name="external"
                            size={11}
                            className="text-chrono-text-muted opacity-0 group-hover:opacity-100 transition-opacity"
                          />
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </Section>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
