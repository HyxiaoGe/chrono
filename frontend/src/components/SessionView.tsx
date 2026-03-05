"use client";

import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type {
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
import { ProposalCard } from "./ProposalCard";
import { Timeline } from "./Timeline";
import { DetailPanel } from "./DetailPanel";
import { MiniMap } from "./MiniMap";

const ACTIVE_SESSION_KEY = "chrono-active-session";

interface ActiveSession {
  sessionId: string;
  topic: string;
}

function setActiveSession(session: ActiveSession): void {
  try {
    localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(session));
  } catch {
    /* quota exceeded or storage unavailable */
  }
}

function clearActiveSession(): void {
  try {
    localStorage.removeItem(ACTIVE_SESSION_KEY);
  } catch {
    /* storage unavailable */
  }
}

type SessionPhase = "loading" | "proposal" | "research" | "error";

interface Props {
  sessionId: string;
}

export function SessionView({ sessionId }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [locale, toggleLocale] = useLocale();

  const [phase, setPhase] = useState<SessionPhase>("loading");
  const [proposal, setProposal] = useState<ResearchProposal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [realSessionId, setRealSessionId] = useState<string | null>(
    sessionId === "new" ? null : sessionId,
  );

  const [streamSessionId, setStreamSessionId] = useState<string | null>(null);
  const [nodes, setNodes] = useState<TimelineNode[]>([]);
  const [progressMessage, setProgressMessage] = useState("");
  const [synthesisData, setSynthesisData] = useState<SynthesisData | null>(null);
  const [completeData, setCompleteData] = useState<CompleteData | null>(null);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Init ---
  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

    if (sessionId === "new") {
      // New search — POST to create session
      const topic = searchParams.get("topic");
      if (!topic) {
        setPhase("error");
        setError("No topic provided.");
        return;
      }

      fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, language: "auto" }),
      })
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then((data) => {
          const sid: string = data.session_id;
          setRealSessionId(sid);
          setProposal(data.proposal);

          // Update URL to real session ID
          window.history.replaceState(null, "", `/app/session/${sid}`);

          if (data.cached) {
            setActiveSession({ sessionId: sid, topic: data.proposal.topic });
            setStreamSessionId(sid);
            setPhase("research");
          } else {
            setPhase("proposal");
          }
        })
        .catch(() => {
          setPhase("error");
          setError("Failed to create research. Please try again.");
        });
      return;
    }

    // Existing session — fetch status
    fetch(`/api/research/${sessionId}/status`)
      .then((res) => {
        if (!res.ok) throw new Error("not_found");
        return res.json();
      })
      .then((data: { status: string; proposal: ResearchProposal }) => {
        setProposal(data.proposal);

        if (data.status === "proposal_ready") {
          setPhase("proposal");
        } else if (data.status === "executing" || data.status === "completed") {
          setPhase("research");
          setStreamSessionId(sessionId);
        } else if (data.status === "failed") {
          clearActiveSession();
          setPhase("error");
          setError("Research failed. Please try again.");
        }
      })
      .catch(() => {
        clearActiveSession();
        setPhase("error");
        setError("Session not found or expired.");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleConfirm() {
    if (!proposal || !realSessionId) return;
    setActiveSession({ sessionId: realSessionId, topic: proposal.topic });
    setStreamSessionId(realSessionId);
    setPhase("research");
  }

  function handleCancel() {
    router.push("/app");
  }

  function handleNewResearch() {
    clearActiveSession();
    router.push("/app");
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

  // --- SSE ---
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
      ({
        nodes: skeletonNodes,
        partial,
      }: {
        nodes: SkeletonNodeData[];
        partial?: boolean;
      }) => {
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
      setPhase("error");
      setError("Connection lost. Please try again.");
    }, []),
  });

  // --- Derived ---
  const language = proposal?.language ?? "en";
  const selectedNode =
    selectedNodeId ? (nodes.find((n) => n.id === selectedNodeId) ?? null) : null;
  const connectionMap = useConnections(synthesisData?.connections, nodes);
  const phaseGroups = useMemo(() => computePhaseGroups(nodes), [nodes]);

  const nodeIds = useMemo(() => nodes.map((n) => n.id), [nodes]);
  const activeNodeId = useActiveNode(nodeIds);

  const activeNode = activeNodeId
    ? nodes.find((n) => n.id === activeNodeId)
    : null;
  const activeYear = activeNode ? activeNode.date.slice(0, 4) : null;
  const activePhase = activeNode?.phase_name ?? null;

  return (
    <AppShell
      locale={locale}
      onToggleLocale={toggleLocale}
      topic={proposal?.topic ?? searchParams.get("topic") ?? undefined}
      showResearchBar={phase === "research"}
      activeYear={activeYear}
      activePhase={activePhase}
      onNewResearch={phase === "research" ? handleNewResearch : undefined}
    >
      {phase === "loading" && (
        <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
          <div className="text-chrono-text-muted text-chrono-caption animate-pulse">
            {locale === "zh" ? "加载中..." : "Loading..."}
          </div>
        </div>
      )}

      {phase === "error" && (
        <div className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center gap-4">
          <p className="text-sm text-red-400">{error}</p>
          <button
            onClick={() => router.push("/app")}
            className="cursor-pointer text-chrono-caption text-chrono-text-muted transition-colors hover:text-chrono-text-secondary"
          >
            {locale === "zh" ? "\u2190 返回首页" : "\u2190 Back to home"}
          </button>
        </div>
      )}

      {phase === "proposal" && proposal && (
        <div className="animate-fade-in">
          <ProposalCard
            proposal={proposal}
            onConfirm={handleConfirm}
            onCancel={handleCancel}
            locale={locale}
          />
        </div>
      )}

      {phase === "research" && (
        <div className="animate-fade-in">
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
