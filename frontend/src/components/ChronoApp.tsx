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

const ACTIVE_SESSION_KEY = "chrono-active-session";

interface ActiveSession {
  sessionId: string;
  topic: string;
}

function getActiveSession(): ActiveSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ACTIVE_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function setActiveSession(session: ActiveSession): void {
  try {
    localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(session));
  } catch { /* quota exceeded or storage unavailable */ }
}

function clearActiveSession(): void {
  try {
    localStorage.removeItem(ACTIVE_SESSION_KEY);
  } catch { /* storage unavailable */ }
}

export function ChronoApp() {
  const [locale, toggleLocale] = useLocale();
  const [initialParams] = useState(() => {
    if (typeof window === "undefined") return { topic: null as string | null, session: null as string | null };
    const params = new URLSearchParams(window.location.search);
    return { topic: params.get("topic"), session: params.get("session") };
  });

  const [phase, setPhase] = useState<AppPhase>("input");
  const [initializing, setInitializing] = useState(true);
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
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [proposal, setProposal] = useState<ResearchProposal | null>(null);
  const proposalCache = useRef<Map<string, { sessionId: string; proposal: ResearchProposal }>>(new Map());

  // Research phase
  const [streamSessionId, setStreamSessionId] = useState<string | null>(null);
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
          let detail = `HTTP ${res.status}`;
          try {
            const body = await res.json();
            detail = body?.detail?.message ?? body?.detail ?? detail;
          } catch { /* no json body */ }
          console.error("[Chrono] POST /api/research failed:", res.status, detail);
          setError(detail);
          return;
        }
        const data = await res.json();
        setSessionId(data.session_id);
        setProposal(data.proposal);

        window.history.replaceState(
          null, "",
          `/app?topic=${encodeURIComponent(data.proposal.topic)}&session=${data.session_id}`,
        );

        if (data.cached) {
          setActiveSession({ sessionId: data.session_id, topic: data.proposal.topic });
          transitionTo("research", () => {
            setStreamSessionId(data.session_id);
          });
        } else {
          proposalCache.current.set(normalizeKey(data.proposal.topic), {
            sessionId: data.session_id,
            proposal: data.proposal,
          });
          transitionTo("proposal");
        }
      } catch (err) {
        console.error("[Chrono] POST /api/research error:", err);
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
        setActiveSession({ sessionId, topic: proposal.topic });
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

  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

    const urlSession = initialParams.session;
    const active = getActiveSession();
    const restoreSessionId = urlSession ?? active?.sessionId ?? null;

    if (restoreSessionId) {
      fetch(`/api/research/${restoreSessionId}/status`)
        .then((res) => {
          if (!res.ok) throw new Error("not_found");
          return res.json();
        })
        .then((data: { status: string; proposal: ResearchProposal }) => {
          setSessionId(restoreSessionId);
          setProposal(data.proposal);

          window.history.replaceState(
            null, "",
            `/app?topic=${encodeURIComponent(data.proposal.topic)}&session=${restoreSessionId}`,
          );

          if (data.status === "proposal_ready") {
            setPhase("proposal");
          } else if (data.status === "completed" || data.status === "executing") {
            setPhase("research");
            setStreamSessionId(restoreSessionId);
          } else if (data.status === "failed") {
            clearActiveSession();
            window.history.replaceState(null, "", "/app");
            setPhase("input");
            setError("Previous research failed. Please try again.");
          }
          setInitializing(false);
        })
        .catch(() => {
          clearActiveSession();
          window.history.replaceState(null, "", "/app");
          setPhase("input");
          setInitializing(false);
        });
      return;
    }

    setInitializing(false);
    if (initialParams.topic) {
      handleSearch(initialParams.topic);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function guardedSelectTopic(topic: string) {
    if (isPending || transitioning) return;
    handleSearch(topic);
  }

  function handleNewResearch() {
    clearActiveSession();
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
      ({ nodes: skeletonNodes, partial }: { nodes: SkeletonNodeData[]; partial?: boolean }) => {
        if (partial) {
          setNodes((prev) => {
            const incoming = skeletonNodes.map((n) => ({
              ...n,
              status: "skeleton" as const,
            }));
            const merged = [...prev, ...incoming];
            merged.sort((a, b) => a.date.localeCompare(b.date));
            return merged;
          });
        } else {
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
        }
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
      clearActiveSession();
    }, []),

    onResearchError: useCallback((data: { error: string; message: string }) => {
      setError(data.message);
      clearActiveSession();
    }, []),

    onConnectionError: useCallback(() => {
      clearActiveSession();
      window.history.replaceState(null, "", "/app");
      setPhase("input");
      setStreamSessionId(null);
      setSessionId(null);
      setNodes([]);
      setProgressMessage("");
      setSynthesisData(null);
      setCompleteData(null);
      setError("Connection lost. Please try again.");
    }, []),
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
      showResearchBar={phase === "research" && !initializing}
      activeYear={activeYear}
      activePhase={activePhase}
      onNewResearch={phase === "research" ? handleNewResearch : undefined}
    >
      {initializing && (
        <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
          <div className="text-chrono-text-muted text-chrono-caption animate-pulse">
            {locale === "zh" ? "恢复中..." : "Restoring..."}
          </div>
        </div>
      )}
      {!initializing && phase === "input" && (
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
      {!initializing && phase === "proposal" && proposal && (
        <div className={transitioning ? "animate-fade-out" : ""}>
          <ProposalCard
            proposal={proposal}
            onConfirm={handleConfirm}
            onCancel={handleCancel}
            locale={locale}
          />
        </div>
      )}
      {!initializing && phase === "research" && (
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
