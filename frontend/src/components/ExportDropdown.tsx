"use client";

import { useState, useRef, useEffect } from "react";
import type {
  ResearchProposal,
  TimelineNode,
  SynthesisData,
  CompleteData,
} from "@/types";
import type { PhaseGroup } from "@/utils/timeline";

interface Props {
  proposal: ResearchProposal | null;
  nodes: TimelineNode[];
  synthesisData: SynthesisData | null;
  completeData: CompleteData | null;
  phaseGroups: PhaseGroup[];
  timelineContainerId: string;
  language: string;
}

function downloadBlob(blob: Blob, filename: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function buildFilenameBase(topic: string | undefined): string {
  const safe = (topic ?? "export").replace(/[^a-zA-Z0-9\u4e00-\u9fff-]/g, "_");
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return `chrono-${safe}-${ts}`;
}

export function ExportDropdown({
  proposal,
  nodes,
  synthesisData,
  completeData,
  phaseGroups,
  timelineContainerId,
  language,
}: Props) {
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isZh = language.startsWith("zh");

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function exportJSON() {
    const data = { proposal, nodes, synthesisData, completeData };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    downloadBlob(blob, `${buildFilenameBase(proposal?.topic)}.json`);
    setOpen(false);
  }

  function exportMarkdown() {
    const lines: string[] = [];
    const topic = proposal?.user_facing?.title ?? proposal?.topic ?? "Timeline";

    lines.push(`# ${topic}`);
    if (synthesisData?.summary) {
      lines.push("", `> ${synthesisData.summary}`);
    }
    if (synthesisData?.key_insight) {
      lines.push("", `*${synthesisData.key_insight}*`);
    }
    lines.push("");

    const phaseMap = new Map(phaseGroups.map((g) => [g.startIndex, g]));

    for (let i = 0; i < nodes.length; i++) {
      const pg = phaseMap.get(i);
      if (pg) {
        lines.push(`## ${pg.name}`, "");
      }

      const node = nodes[i];
      lines.push(`### ${node.date} — ${node.title}`);
      lines.push("", node.description);

      if (node.details) {
        if (node.details.impact) {
          lines.push("", `**${isZh ? "影响" : "Impact"}:** ${node.details.impact}`);
        }
        if (node.details.key_people.length > 0) {
          lines.push(`**${isZh ? "关键人物" : "Key people"}:** ${node.details.key_people.join(", ")}`);
        }
        if (node.details.sources.length > 0) {
          lines.push(`**${isZh ? "来源" : "Sources"}:** ${node.details.sources.join(", ")}`);
        }
      }
      lines.push("");
    }

    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    downloadBlob(blob, `${buildFilenameBase(proposal?.topic)}.md`);
    setOpen(false);
  }

  async function exportPNG() {
    setExporting(true);
    setOpen(false);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const el = document.getElementById(timelineContainerId);
      if (!el) return;

      const hidden = el.querySelectorAll<HTMLElement>("[data-export-hide]");
      hidden.forEach((h) => (h.style.display = "none"));

      const canvas = await html2canvas(el, {
        backgroundColor: "#06060a",
        scale: 2,
      });

      hidden.forEach((h) => (h.style.display = ""));

      canvas.toBlob((blob) => {
        if (blob) downloadBlob(blob, `${buildFilenameBase(proposal?.topic)}.png`);
      });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen(!open)}
        disabled={exporting}
        className="rounded border border-chrono-border px-2 py-0.5 text-chrono-tiny text-chrono-text-muted transition-colors hover:border-chrono-border-active hover:text-chrono-text-secondary disabled:opacity-50"
      >
        {exporting ? (isZh ? "导出中…" : "Exporting…") : (isZh ? "导出 ▾" : "Export ▾")}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-40 mt-1 min-w-[120px] rounded border border-chrono-border bg-chrono-surface py-1 shadow-lg">
          <button
            onClick={exportJSON}
            className="block w-full px-3 py-1.5 text-left text-chrono-tiny text-chrono-text-secondary transition-colors hover:bg-chrono-surface-hover"
          >
            JSON
          </button>
          <button
            onClick={exportMarkdown}
            className="block w-full px-3 py-1.5 text-left text-chrono-tiny text-chrono-text-secondary transition-colors hover:bg-chrono-surface-hover"
          >
            Markdown
          </button>
          <button
            onClick={exportPNG}
            className="block w-full px-3 py-1.5 text-left text-chrono-tiny text-chrono-text-secondary transition-colors hover:bg-chrono-surface-hover"
          >
            PNG
          </button>
        </div>
      )}
    </div>
  );
}
