"use client";

import { useState, useCallback, useTransition } from "react";
import type {
  AppPhase,
  ResearchProposal,
  TimelineNode,
  SynthesisData,
  CompleteData,
  ProgressData,
  SkeletonNodeData,
  NodeDetailEvent,
} from "@/types";
import { useResearchStream } from "@/hooks/useResearchStream";
import { AppShell } from "./AppShell";
import { SearchInput } from "./SearchInput";
import { ProposalCard } from "./ProposalCard";
import { Timeline } from "./Timeline";
import { DetailPanel } from "./DetailPanel";

export function ChronoApp() {
  const [phase, setPhase] = useState<AppPhase>("input");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Proposal phase
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [proposal, setProposal] = useState<ResearchProposal | null>(null);

  // Research phase
  const [streamSessionId, setStreamSessionId] = useState<string | null>(null);
  const [nodes, setNodes] = useState<TimelineNode[]>([]);
  const [progressMessage, setProgressMessage] = useState("");
  const [synthesisData, setSynthesisData] = useState<SynthesisData | null>(null);
  const [completeData, setCompleteData] = useState<CompleteData | null>(null);

  // Detail panel
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  function handleSearch(topic: string) {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/research", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic, language: "auto" }),
        });
        if (!res.ok) {
          setError("Service temporarily unavailable. Please try again.");
          return;
        }
        const data = await res.json();
        setSessionId(data.session_id);
        setProposal(data.proposal);
        setPhase("proposal");
      } catch {
        setError("Network error. Please check your connection.");
      }
    });
  }

  function handleConfirm() {
    setPhase("research");
    setStreamSessionId(sessionId);
  }

  function handleCancel() {
    setPhase("input");
    setSessionId(null);
    setProposal(null);
  }

  useResearchStream(streamSessionId, {
    onProgress: useCallback((data: ProgressData) => {
      setProgressMessage(data.message);
      if (data.phase === "detail") {
        setNodes((prev) =>
          prev.map((n) =>
            n.status === "skeleton" ? { ...n, status: "loading" as const } : n,
          ),
        );
      }
    }, []),

    onSkeleton: useCallback(
      ({ nodes: skeletonNodes }: { nodes: SkeletonNodeData[] }) => {
        setNodes((prev) => {
          const existingMap = new Map(prev.map((n) => [n.id, n]));
          return skeletonNodes.map((n) => {
            const existing = existingMap.get(n.id);
            if (existing?.details) {
              return { ...n, status: existing.status, details: existing.details };
            }
            return { ...n, status: "skeleton" as const };
          });
        });
      },
      [],
    ),

    onNodeDetail: useCallback(({ node_id, details }: NodeDetailEvent) => {
      setNodes((prev) =>
        prev.map((n) =>
          n.id === node_id
            ? {
                ...n,
                details,
                status: "complete" as const,
                sources: [...n.sources, ...details.sources],
              }
            : n,
        ),
      );
    }, []),

    onSynthesis: useCallback((data: SynthesisData) => {
      setSynthesisData(data);
    }, []),

    onComplete: useCallback((data: CompleteData) => {
      setCompleteData(data);
      setProgressMessage("");
    }, []),
  });

  const language = proposal?.language ?? "en";
  const selectedNode =
    selectedNodeId ? (nodes.find((n) => n.id === selectedNodeId) ?? null) : null;

  return (
    <AppShell
      topic={phase !== "input" ? proposal?.topic : undefined}
      showTopBar={phase !== "input"}
    >
      {phase === "input" && (
        <SearchInput
          onSearch={handleSearch}
          isPending={isPending}
          error={error}
        />
      )}
      {phase === "proposal" && proposal && (
        <ProposalCard
          proposal={proposal}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
      {phase === "research" && (
        <>
          <Timeline
            nodes={nodes}
            progressMessage={progressMessage}
            synthesisData={synthesisData}
            completeData={completeData}
            proposal={proposal}
            language={language}
            selectedNodeId={selectedNodeId}
            onSelectNode={setSelectedNodeId}
          />
          <DetailPanel
            node={selectedNode}
            language={language}
            onClose={() => setSelectedNodeId(null)}
          />
        </>
      )}
    </AppShell>
  );
}
