import React from "react";

const TONES: Record<string, string> = {
  revolutionary: "bg-chrono-revolutionary/15 text-chrono-revolutionary",
  high: "bg-chrono-high/15 text-chrono-high",
  mediumSig: "bg-chrono-medium/15 text-chrono-text-muted",
  accent: "bg-chrono-accent/10 text-chrono-accent",
  caused: "bg-chrono-caused/15 text-chrono-caused",
  enabled: "bg-chrono-enabled/15 text-chrono-enabled",
  inspired: "bg-chrono-inspired/15 text-chrono-inspired",
  responded: "bg-chrono-responded/15 text-chrono-responded",
  plain: "bg-chrono-surface border border-chrono-border/60 text-chrono-text-secondary",
};

interface Props {
  tone: string;
  children: React.ReactNode;
  className?: string;
}

export function Chip({ tone, children, className = "" }: Props) {
  const colors = TONES[tone] ?? "bg-chrono-border/60 text-chrono-text-muted";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-chrono-tiny font-medium ${colors} ${className}`}
    >
      {children}
    </span>
  );
}
