"use client";

import { useState } from "react";
import type { TimelineNode } from "@/types";

const LABELS: Record<string, Record<string, string>> = {
  key_features: { zh: "关键特性", en: "Key Features" },
  impact: { zh: "影响", en: "Impact" },
  key_people: { zh: "关键人物", en: "Key People" },
  context: { zh: "背景", en: "Context" },
  sources: { zh: "来源", en: "Sources" },
};

function label(key: string, language: string): string {
  const entry = LABELS[key];
  if (!entry) return key;
  if (language.startsWith("zh")) return entry.zh;
  return entry.en;
}

interface Props {
  node: TimelineNode;
  side: "left" | "right";
  language: string;
}

export function TimelineNodeCard({ node, side, language }: Props) {
  const [expanded, setExpanded] = useState(false);
  const isComplete = node.status === "complete";
  const isRevolutionary = node.significance === "revolutionary";

  const dotSize = isRevolutionary
    ? "h-4 w-4 bg-amber-400 ring-4 ring-amber-400/20"
    : node.significance === "high"
      ? "h-3 w-3 bg-zinc-400"
      : "h-2.5 w-2.5 bg-zinc-600";

  return (
    <div className="relative mb-10 flex items-start">
      {/* Center dot */}
      <div className="absolute left-1/2 top-2 z-10 -translate-x-1/2">
        <div className={`rounded-full ${dotSize}`} />
      </div>

      {/* Card */}
      <div
        className={`w-[calc(50%-2rem)] ${
          side === "left" ? "pr-8" : "ml-auto pl-8"
        }`}
      >
        {isComplete ? (
          <div
            className={`animate-fade-in rounded-xl border p-5 cursor-pointer transition-colors ${
              isRevolutionary
                ? "border-amber-400/30 bg-zinc-900 shadow-lg shadow-amber-400/5"
                : "border-zinc-800 bg-zinc-900 hover:border-zinc-700"
            }`}
            onClick={() => setExpanded(!expanded)}
          >
            <div className="text-xs text-zinc-500">{node.date}</div>
            <h3
              className={`mt-1 font-semibold ${isRevolutionary ? "text-amber-200" : ""}`}
            >
              {node.title}
            </h3>
            <p className="mt-2 text-sm text-zinc-400">{node.description}</p>

            {expanded && node.details && (
              <div className="animate-fade-in mt-4 space-y-4 border-t border-zinc-800 pt-4">
                <DetailSection
                  title={label("key_features", language)}
                >
                  <ul className="space-y-1">
                    {node.details.key_features.map((f, i) => (
                      <li key={i} className="text-sm text-zinc-300">
                        • {f}
                      </li>
                    ))}
                  </ul>
                </DetailSection>

                <DetailSection title={label("impact", language)}>
                  <p className="text-sm text-zinc-300">
                    {node.details.impact}
                  </p>
                </DetailSection>

                {node.details.key_people.length > 0 && (
                  <DetailSection
                    title={label("key_people", language)}
                  >
                    <ul className="space-y-1">
                      {node.details.key_people.map((p, i) => (
                        <li key={i} className="text-sm text-zinc-300">
                          {p}
                        </li>
                      ))}
                    </ul>
                  </DetailSection>
                )}

                <DetailSection title={label("context", language)}>
                  <p className="text-sm text-zinc-300">
                    {node.details.context}
                  </p>
                </DetailSection>

                {node.sources.length > 0 && (
                  <DetailSection title={label("sources", language)}>
                    <ul className="space-y-1">
                      {node.sources.map((url, i) => (
                        <li key={i}>
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block truncate text-xs text-zinc-500 hover:text-zinc-300"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {url}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </DetailSection>
                )}
              </div>
            )}
          </div>
        ) : (
          /* Skeleton state */
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <div className="text-xs text-zinc-500">{node.date}</div>
            <div className="mt-1 font-semibold">{node.title}</div>
            <div className="mt-3 space-y-2">
              <div className="h-3 w-full animate-pulse rounded bg-zinc-800" />
              <div className="h-3 w-4/5 animate-pulse rounded bg-zinc-800" />
              <div className="h-3 w-3/5 animate-pulse rounded bg-zinc-800" />
            </div>
          </div>
        )}
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
      <h4 className="text-xs font-medium uppercase tracking-wider text-zinc-500">
        {title}
      </h4>
      <div className="mt-1">{children}</div>
    </div>
  );
}
