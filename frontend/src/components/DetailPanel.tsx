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
  sources: { zh: "来源", en: "Sources" },
  connected: { zh: "关联节点", en: "Connected Moments" },
  key_stats: { zh: "关键数据", en: "By the Numbers" },
  description: { zh: "概述", en: "Overview" },
  tags: { zh: "标签", en: "Tags" },
  led_to: { zh: "导致", en: "Led to" },
  shaped_by: { zh: "受影响于", en: "Shaped by" },
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
  return language.startsWith("zh") ? entry.zh : entry.en;
}

/* ------------------------------------------------------------------ */
/*  Atomic components                                                  */
/* ------------------------------------------------------------------ */

function SectionHeader({
  title,
  count,
  accent,
}: {
  title: string;
  count?: number;
  accent?: boolean;
}) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-2">
      <h4
        className={`text-chrono-tiny font-semibold uppercase tracking-[0.14em] ${
          accent ? "text-chrono-accent/90" : "text-chrono-text-secondary"
        }`}
      >
        {title}
      </h4>
      {typeof count !== "undefined" && (
        <span className="text-chrono-tiny font-mono tabular-nums text-chrono-text-muted">
          {count}
        </span>
      )}
    </div>
  );
}

function Divider() {
  return <div className="h-px bg-chrono-border/30" />;
}

function RelatedRow({
  nodeTitle,
  nodeDate,
  type,
  direction,
  language,
  onSelect,
}: {
  nodeTitle: string;
  nodeDate: string;
  type: string;
  direction: "out" | "in";
  language: string;
  onSelect: () => void;
}) {
  const c = connColor(type);
  const arrow = direction === "out" ? "→" : "←";
  return (
    <button
      onClick={onSelect}
      className="group w-full rounded-lg border border-chrono-border/40 bg-chrono-surface/40 hover:bg-chrono-surface-hover hover:border-chrono-border-active transition-colors text-left"
    >
      <div className="flex items-center gap-3 px-3 py-2.5">
        <div
          className="shrink-0 flex items-center gap-1 rounded-md px-1.5 py-0.5"
          style={{ backgroundColor: `${c}18`, color: c }}
        >
          <span className="text-[11px] leading-none font-mono font-semibold">{arrow}</span>
          <span className="text-[10px] uppercase tracking-wider font-medium">
            {label(type, language)}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-chrono-caption text-chrono-text font-medium truncate">
            {nodeTitle}
          </div>
          {nodeDate && (
            <div className="mt-0.5 text-[10px] font-mono tabular-nums text-chrono-text-muted">
              {nodeDate.slice(0, 7)}
            </div>
          )}
        </div>
        <Icon
          name="chevronRight"
          size={12}
          className="shrink-0 text-chrono-text-muted/50 group-hover:text-chrono-text-muted group-hover:translate-x-0.5 transition-all"
        />
      </div>
    </button>
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

  // Build related-nodes list, split by direction
  const connInfo = connectionMap.get(node.id);
  const outgoing: { nodeId: string; nodeTitle: string; nodeDate: string; type: string }[] = [];
  const incoming: { nodeId: string; nodeTitle: string; nodeDate: string; type: string }[] = [];
  if (connInfo) {
    for (const c of connInfo.outgoing) {
      outgoing.push({
        nodeId: c.targetId,
        nodeTitle: c.targetTitle,
        nodeDate: "",
        type: c.type,
      });
    }
    for (const c of connInfo.incoming) {
      incoming.push({
        nodeId: c.sourceId,
        nodeTitle: c.sourceTitle,
        nodeDate: "",
        type: c.type,
      });
    }
  }
  const hasRelated = outgoing.length > 0 || incoming.length > 0;

  return (
    <aside className="sticky top-[126px] w-[380px] shrink-0 self-start h-[calc(100vh-9rem)]">
      <div className="relative h-full flex flex-col rounded-xl border border-chrono-border/50 bg-chrono-surface/60 backdrop-blur-md overflow-hidden">
        {/* ---- HEADER ---- */}
        <div
          className="shrink-0 border-b border-chrono-border/40 px-5 pt-4 pb-4 relative"
          style={{
            background: `linear-gradient(180deg, ${color}12 0%, transparent 100%)`,
          }}
        >
          {/* Significance accent bar */}
          <div
            className="absolute left-0 top-0 bottom-0 w-[3px]"
            style={{ backgroundColor: color, opacity: sig === "revolutionary" ? 0.9 : 0.5 }}
          />

          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-2.5">
                <span className="text-chrono-tiny font-mono text-chrono-text-muted tabular-nums">
                  {node.date}
                </span>
                <span className="text-chrono-border">·</span>
                <Chip tone={sigTone}>{label(sig, language)}</Chip>
              </div>
              <h2
                className={`text-chrono-title font-semibold leading-[1.2] tracking-tight ${
                  sig === "revolutionary"
                    ? "text-chrono-revolutionary"
                    : "text-chrono-text"
                }`}
              >
                {node.title}
              </h2>
              {node.subtitle && (
                <p className="mt-1.5 text-chrono-caption text-chrono-text-secondary leading-snug">
                  {node.subtitle}
                </p>
              )}
              {details?.location && (
                <div className="mt-3 inline-flex items-center gap-1.5 text-chrono-tiny text-chrono-text-muted">
                  <Icon name="pin" size={11} />
                  {details.location}
                </div>
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

        {/* ---- SCROLL BODY ---- */}
        <div className="flex-1 overflow-y-auto">
          {/* Description */}
          <div className="px-5 pt-5 pb-6">
            <p className="text-chrono-body leading-relaxed text-chrono-text-secondary">
              {node.description}
            </p>
          </div>

          {/* Key stats */}
          {details?.key_stats && details.key_stats.length > 0 && (
            <>
              <Divider />
              <div className="px-5 py-5">
                <SectionHeader title={label("key_stats", language)} />
                <div className="grid grid-cols-3 gap-2">
                  {details.key_stats.map((stat, i) => (
                    <div
                      key={i}
                      className="flex flex-col justify-between rounded-lg bg-chrono-bg/40 px-3 py-3 min-h-[64px]"
                    >
                      <div className="text-chrono-body font-semibold text-chrono-text font-mono tabular-nums">
                        {stat}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Notable quote */}
          {details?.notable_quote && (
            <>
              <Divider />
              <div className="px-5 py-5">
                <div className="relative">
                  <span
                    aria-hidden="true"
                    className="absolute -top-2 -left-1 text-[44px] leading-none font-serif text-chrono-accent/30 select-none"
                  >
                    &ldquo;
                  </span>
                  <blockquote className="pl-6 pr-2">
                    <p className="text-[15px] leading-[1.55] italic text-chrono-text">
                      {details.notable_quote}
                    </p>
                    {details.key_people && details.key_people[0] && (
                      <footer className="mt-3 flex items-center gap-2">
                        <span className="h-px w-4 bg-chrono-accent/40" />
                        <cite className="not-italic text-chrono-tiny text-chrono-text-muted">
                          {details.key_people[0].split(" — ")[0]}
                        </cite>
                      </footer>
                    )}
                  </blockquote>
                </div>
              </div>
            </>
          )}

          {/* Key features */}
          {details?.key_features && details.key_features.length > 0 && (
            <>
              <Divider />
              <div className="px-5 py-5">
                <SectionHeader title={label("key_features", language)} />
                <ul className="space-y-2">
                  {details.key_features.map((f, i) => (
                    <li
                      key={i}
                      className="flex gap-3 text-chrono-caption text-chrono-text-secondary leading-relaxed"
                    >
                      <span
                        className="mt-[7px] h-1 w-1 shrink-0 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}

          {/* Impact */}
          {details?.impact && (
            <>
              <Divider />
              <div className="px-5 py-5">
                <SectionHeader title={label("impact", language)} />
                <p className="text-chrono-caption text-chrono-text-secondary leading-relaxed">
                  {details.impact}
                </p>
              </div>
            </>
          )}

          {/* Key people */}
          {details?.key_people && details.key_people.length > 0 && (
            <>
              <Divider />
              <div className="px-5 py-5">
                <SectionHeader
                  title={label("key_people", language)}
                  count={details.key_people.length}
                />
                <ul className="space-y-2.5">
                  {details.key_people.map((p, i) => {
                    const parts = p.split(" — ");
                    const initials = parts[0]
                      .split(" ")
                      .map((w) => w[0])
                      .slice(0, 2)
                      .join("");
                    return (
                      <li key={i} className="flex items-center gap-3">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-chrono-border/50 bg-chrono-bg/40 text-[10px] font-semibold text-chrono-text-secondary font-mono">
                          {initials}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-chrono-caption font-medium text-chrono-text truncate">
                            {parts[0]}
                          </div>
                          {parts[1] && (
                            <div className="text-[11px] text-chrono-text-muted truncate">
                              {parts[1]}
                            </div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </>
          )}

          {/* Tags */}
          {details?.tags && details.tags.length > 0 && (
            <>
              <Divider />
              <div className="px-5 py-5">
                <SectionHeader title={label("tags", language)} />
                <div className="flex flex-wrap gap-1.5">
                  {details.tags.map((t) => (
                    <Chip key={t} tone="accent">
                      {tagLabel(t, language)}
                    </Chip>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ---- CONNECTED MOMENTS — distinct navigational zone ---- */}
          {hasRelated && (
            <div className="mt-2 bg-chrono-bg/50 border-t-2 border-chrono-border/50">
              <div className="px-5 py-5">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-chrono-accent/80"
                    >
                      <circle cx="6" cy="6" r="2" />
                      <circle cx="18" cy="18" r="2" />
                      <path d="M8 8l8 8" />
                    </svg>
                    <h4 className="text-chrono-tiny font-semibold uppercase tracking-[0.14em] text-chrono-accent/90">
                      {label("connected", language)}
                    </h4>
                  </div>
                  <span className="inline-flex items-center rounded-full bg-chrono-accent/15 text-chrono-accent/90 px-1.5 py-0.5 text-[10px] font-mono tabular-nums font-medium">
                    {outgoing.length + incoming.length}
                  </span>
                </div>

                {outgoing.length > 0 && (
                  <div className="mb-3">
                    <div className="mb-1.5 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-chrono-text-muted">
                      <span>{label("led_to", language)}</span>
                      <span className="h-px flex-1 bg-chrono-border/30" />
                      <span className="font-mono tabular-nums">{outgoing.length}</span>
                    </div>
                    <div className="space-y-1.5">
                      {outgoing.map((r, i) => (
                        <RelatedRow
                          key={i}
                          nodeTitle={r.nodeTitle}
                          nodeDate={r.nodeDate}
                          type={r.type}
                          direction="out"
                          language={language}
                          onSelect={() => onNavigateToNode(r.nodeId)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {incoming.length > 0 && (
                  <div>
                    <div className="mb-1.5 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-chrono-text-muted">
                      <span>{label("shaped_by", language)}</span>
                      <span className="h-px flex-1 bg-chrono-border/30" />
                      <span className="font-mono tabular-nums">{incoming.length}</span>
                    </div>
                    <div className="space-y-1.5">
                      {incoming.map((r, i) => (
                        <RelatedRow
                          key={i}
                          nodeTitle={r.nodeTitle}
                          nodeDate={r.nodeDate}
                          type={r.type}
                          direction="in"
                          language={language}
                          onSelect={() => onNavigateToNode(r.nodeId)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Sources */}
          {node.sources && node.sources.length > 0 && (
            <>
              <Divider />
              <div className="px-5 py-5">
                <SectionHeader
                  title={label("sources", language)}
                  count={node.sources.length}
                />
                <ul className="space-y-0.5 -mx-2">
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
                          className="group flex items-center gap-2.5 rounded-md px-2 py-1.5 text-chrono-tiny hover:bg-chrono-surface/70 transition-colors"
                        >
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-chrono-border" />
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
                            className="shrink-0 text-chrono-text-muted opacity-0 group-hover:opacity-100 transition-opacity"
                          />
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </>
          )}

          {/* Bottom breathing room */}
          <div className="h-4" />
        </div>
      </div>
    </aside>
  );
}
