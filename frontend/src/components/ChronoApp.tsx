"use client";

import { useState, useCallback, useTransition, useRef, useMemo, useEffect } from "react";
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
import { useLocale } from "@/data/landing";
import { useResearchStream } from "@/hooks/useResearchStream";
import { useConnections } from "@/hooks/useConnections";
import { useActiveNode } from "@/hooks/useActiveNode";
import { computePhaseGroups } from "@/utils/timeline";
import { AppShell } from "./AppShell";
import { SearchInput } from "./SearchInput";
import { ProposalCard } from "./ProposalCard";
import { Timeline } from "./Timeline";
import { DetailPanel } from "./DetailPanel";
import { MiniMap } from "./MiniMap";

export function ChronoApp() {
  const [locale, toggleLocale] = useLocale();
  const [initialParams] = useState(() => {
    if (typeof window === "undefined") return { topic: null as string | null, session: null as string | null };
    const params = new URLSearchParams(window.location.search);
    return { topic: params.get("topic"), session: params.get("session") };
  });

  const hasSession = initialParams.session !== null;
  const [phase, setPhase] = useState<AppPhase>(hasSession ? "research" : "input");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [transitioning, setTransitioning] = useState(false);

  const TRANSITION_MS = 250;

  function transitionTo(newPhase: AppPhase, setup?: () => void) {
    setTransitioning(true);
    setTimeout(() => {
      setup?.();
      setPhase(newPhase);
      setTransitioning(false);
    }, TRANSITION_MS);
  }

  // Proposal phase
  const [sessionId, setSessionId] = useState<string | null>(initialParams.session);
  const [proposal, setProposal] = useState<ResearchProposal | null>(null);
  const proposalCache = useRef<Map<string, { sessionId: string; proposal: ResearchProposal }>>(new Map());

  // Research phase
  const [streamSessionId, setStreamSessionId] = useState<string | null>(initialParams.session);
  const [nodes, setNodes] = useState<TimelineNode[]>([]);
  const [progressMessage, setProgressMessage] = useState("");
  const [synthesisData, setSynthesisData] = useState<SynthesisData | null>(null);
  const [completeData, setCompleteData] = useState<CompleteData | null>(null);

  // Detail panel
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Search reset key
  const [searchKey, setSearchKey] = useState(0);

  // Highlight (connection navigation)
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function normalizeKey(topic: string): string {
    return topic.trim().toLowerCase();
  }

  function handleSearch(topic: string) {
    setError(null);

    const cached = proposalCache.current.get(normalizeKey(topic));
    if (cached) {
      setSessionId(cached.sessionId);
      setProposal(cached.proposal);
      transitionTo("proposal");
      return;
    }

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

        if (data.cached) {
          transitionTo("research", () => {
            window.history.replaceState(
              null, "",
              `/app?topic=${encodeURIComponent(data.proposal.topic)}&session=${data.session_id}`,
            );
            setStreamSessionId(data.session_id);
          });
        } else {
          proposalCache.current.set(normalizeKey(data.proposal.topic), {
            sessionId: data.session_id,
            proposal: data.proposal,
          });
          transitionTo("proposal");
        }
      } catch {
        setError("Network error. Please check your connection.");
      }
    });
  }

  function handleConfirm() {
    transitionTo("research", () => {
      if (proposal && sessionId) {
        window.history.replaceState(
          null, "",
          `/app?topic=${encodeURIComponent(proposal.topic)}&session=${sessionId}`,
        );
        proposalCache.current.delete(normalizeKey(proposal.topic));
      }
      setStreamSessionId(sessionId);
    });
  }

  function handleCancel() {
    transitionTo("input", () => {
      window.history.replaceState(null, "", "/app");
      setSessionId(null);
      setProposal(null);
      setSearchKey((k) => k + 1);
    });
  }

  const didAutoSearch = useRef(false);
  useEffect(() => {
    if (hasSession || !initialParams.topic || didAutoSearch.current) return;
    didAutoSearch.current = true;

    fetch("/api/research", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: initialParams.topic, language: "auto" }),
    })
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data) => {
        setSessionId(data.session_id);
        setProposal(data.proposal);

        if (data.cached) {
          transitionTo("research", () => {
            window.history.replaceState(
              null, "",
              `/app?topic=${encodeURIComponent(data.proposal.topic)}&session=${data.session_id}`,
            );
            setStreamSessionId(data.session_id);
          });
        } else {
          transitionTo("proposal");
        }
      })
      .catch(() => {
        setError("Service temporarily unavailable. Please try again.");
      });
  }, [hasSession, initialParams.topic]);

  function guardedSelectTopic(topic: string) {
    if (isPending || transitioning) return;
    handleSearch(topic);
  }

  function handleNewResearch() {
    transitionTo("input", () => {
      window.history.replaceState(null, "", "/app");
      setSessionId(null);
      setProposal(null);
      setStreamSessionId(null);
      setNodes([]);
      setProgressMessage("");
      setSynthesisData(null);
      setCompleteData(null);
      setSelectedNodeId(null);
      setHighlightedNodeId(null);
      setError(null);
      setSearchKey((k) => k + 1);
    });
  }

  const handleNavigateToNode = useCallback((targetId: string) => {
    setSelectedNodeId(null);
    requestAnimationFrame(() => {
      document
        .getElementById(targetId)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
      setHighlightedNodeId(targetId);
      highlightTimerRef.current = setTimeout(() => {
        setHighlightedNodeId(null);
      }, 1500);
    });
  }, []);

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

    onConnectionError: useCallback(() => {
      window.history.replaceState(
        null, "",
        initialParams.topic ? `/app?topic=${encodeURIComponent(initialParams.topic)}` : "/app",
      );
      setPhase("input");
      setStreamSessionId(null);
      setSessionId(null);
      setNodes([]);
      setProgressMessage("");
      setSynthesisData(null);
      setCompleteData(null);
      setError("Session expired. Please search again.");
    }, [initialParams.topic]),
  });

  const language = proposal?.language ?? "en";
  const selectedNode =
    selectedNodeId ? (nodes.find((n) => n.id === selectedNodeId) ?? null) : null;
  const connectionMap = useConnections(synthesisData?.connections, nodes);
  const phaseGroups = useMemo(() => computePhaseGroups(nodes), [nodes]);

  const nodeIds = useMemo(() => nodes.map((n) => n.id), [nodes]);
  const activeNodeId = useActiveNode(nodeIds);

  const activeNode = activeNodeId ? nodes.find((n) => n.id === activeNodeId) : null;
  const activeYear = activeNode ? activeNode.date.slice(0, 4) : null;
  const activePhase = activeNode?.phase_name ?? null;

  return (
    <AppShell
      locale={locale}
      onToggleLocale={toggleLocale}
      topic={proposal?.topic ?? initialParams.topic ?? undefined}
      showResearchBar={phase === "research"}
      activeYear={activeYear}
      activePhase={activePhase}
      onNewResearch={handleNewResearch}
    >
      {phase === "input" && (
        <div className={transitioning ? "animate-fade-out" : ""}>
          <SearchInput
            key={searchKey}
            onSearch={handleSearch}
            isPending={isPending || transitioning}
            error={error}
            onSelectTopic={guardedSelectTopic}
            locale={locale}
          />
        </div>
      )}
      {phase === "proposal" && proposal && (
        <div className={transitioning ? "animate-fade-out" : ""}>
          <ProposalCard
            proposal={proposal}
            onConfirm={handleConfirm}
            onCancel={handleCancel}
            locale={locale}
          />
        </div>
      )}
      {phase === "research" && (
        <div className={transitioning ? "animate-fade-out" : ""}>
          <Timeline
            nodes={nodes}
            progressMessage={progressMessage}
            synthesisData={synthesisData}
            completeData={completeData}
            proposal={proposal}
            language={language}
            selectedNodeId={selectedNodeId}
            highlightedNodeId={highlightedNodeId}
            onSelectNode={setSelectedNodeId}
            connectionMap={connectionMap}
            phaseGroups={phaseGroups}
          />
          {nodes.length >= 15 && (
            <MiniMap
              nodes={nodes}
              activeNodeId={activeNodeId}
              onNavigateToNode={handleNavigateToNode}
            />
          )}
          <DetailPanel
            node={selectedNode}
            language={language}
            connectionMap={connectionMap}
            onClose={() => setSelectedNodeId(null)}
            onNavigateToNode={handleNavigateToNode}
          />
        </div>
      )}
    </AppShell>
  );
}
