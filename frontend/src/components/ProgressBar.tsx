"use client";

import { Icon } from "@/components/ui/Icon";

interface ProgressBarProps {
  phase: string;
  elapsed: number;
  done: number;
  total: number;
  model: string;
}

const phases = [
  { key: "skeleton", label: "Skeleton" },
  { key: "detail", label: "Detail" },
  { key: "analysis", label: "Analysis" },
  { key: "synthesis", label: "Synthesis" },
];

function getStatusText(phase: string, done: number, total: number): string {
  if (phase === "detail") return `enriching ${done}/${total} nodes…`;
  if (phase === "skeleton") return "generating timeline structure…";
  if (phase === "analysis") return "analyzing causal connections…";
  return "synthesizing insights…";
}

export default function ProgressBar({ phase, elapsed, done, total, model }: ProgressBarProps) {
  const idx = phases.findIndex((p) => p.key === phase);
  const pct = Math.min(
    100,
    Math.round(
      ((idx + (phase === "detail" && total ? done / total : 0)) / phases.length) * 100
    )
  );
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  const time = m > 0 ? `${m}:${String(s).padStart(2, "0")}` : `0:${String(s).padStart(2, "0")}`;

  return (
    <div className="mb-6 rounded-xl border border-chrono-border/60 bg-chrono-surface/80 backdrop-blur-md overflow-hidden">
      <div className="px-5 py-3.5">
        <div className="flex items-center gap-3">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inset-0 rounded-full bg-chrono-accent animate-ping opacity-70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-chrono-accent" />
          </span>
          <div className="flex items-center gap-2 text-chrono-caption">
            {phases.map((p, i) => {
              const active = i === idx;
              const pastDone = i < idx;
              return (
                <span key={p.key} className="flex items-center gap-2">
                  {i > 0 && (
                    <Icon
                      name="chevronRight"
                      size={10}
                      className={pastDone ? "text-chrono-accent/60" : "text-chrono-border"}
                    />
                  )}
                  <span
                    className={
                      active
                        ? "text-chrono-accent font-medium"
                        : pastDone
                        ? "text-chrono-text-secondary"
                        : "text-chrono-text-muted/50"
                    }
                  >
                    {p.label}
                    {active && (
                      <span className="ml-1 text-chrono-text-muted normal-case italic font-normal">
                        …
                      </span>
                    )}
                  </span>
                </span>
              );
            })}
          </div>
          <span className="ml-auto text-chrono-tiny text-chrono-text-muted font-mono tabular-nums">
            {pct}% · {time}
          </span>
        </div>
        <div className="mt-3 flex items-center gap-3 text-chrono-tiny text-chrono-text-muted">
          <span className="rounded bg-chrono-accent/10 border border-chrono-accent/20 px-1.5 py-0.5 text-chrono-accent/80 font-mono">
            {model}
          </span>
          <span>{getStatusText(phase, done, total)}</span>
        </div>
      </div>
      <div className="h-0.5 w-full bg-chrono-border/30 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-chrono-accent/60 via-chrono-accent to-chrono-accent/60 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
