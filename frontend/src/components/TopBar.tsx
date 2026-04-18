"use client";

import { Icon } from "@/components/ui/Icon";
import { LogoMark } from "@/components/ui/LogoMark";

interface TopBarProps {
  topic: string;
  nodeCount: number;
  onBack: () => void;
  language: string;
}

export default function TopBar({ topic, nodeCount, onBack, language }: TopBarProps) {
  const isZh = language.startsWith("zh");
  return (
    <nav className="sticky top-0 z-40 h-14 flex items-center px-5 bg-chrono-bg/80 backdrop-blur-md border-b border-chrono-border/40">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onBack}
          className="flex h-7 w-7 items-center justify-center rounded-md text-chrono-text-muted hover:bg-chrono-surface/60 hover:text-chrono-text-secondary transition-colors"
          title="Back"
        >
          <Icon name="back" size={14} />
        </button>
        <div className="flex items-center gap-1.5 text-chrono-accent">
          <LogoMark size={16} />
          <span className="text-chrono-caption font-bold tracking-wide">Chrono</span>
        </div>
        <span className="text-chrono-border">·</span>
        <span className="text-chrono-caption text-chrono-text-secondary truncate max-w-[360px]">
          {topic}
        </span>
        {nodeCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full border border-chrono-border/50 bg-chrono-surface/60 px-2 py-0.5 text-chrono-tiny font-mono tabular-nums text-chrono-text-muted">
            {nodeCount} nodes
          </span>
        )}
      </div>
      <div className="ml-auto flex items-center gap-1.5">
        <button className="inline-flex items-center gap-1.5 rounded-md px-2.5 h-8 text-chrono-tiny text-chrono-text-secondary hover:bg-chrono-surface/60 transition-colors">
          <Icon name="share" size={13} />{isZh ? "分享" : "Share"}
        </button>
        <button className="inline-flex items-center gap-1.5 rounded-md border border-chrono-border/50 bg-chrono-surface/50 px-2.5 h-8 text-chrono-tiny text-chrono-text-secondary hover:bg-chrono-surface hover:border-chrono-border-active transition-colors">
          <Icon name="download" size={13} />{isZh ? "导出" : "Export"}
        </button>
        <button className="flex h-8 w-8 items-center justify-center rounded-md text-chrono-text-muted hover:bg-chrono-surface/60 hover:text-chrono-text-secondary transition-colors">
          <Icon name="more" size={14} />
        </button>
      </div>
    </nav>
  );
}
