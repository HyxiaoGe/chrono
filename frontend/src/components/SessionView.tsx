"use client";

import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type {
  ResearchProposal,
  SimilarTopicMatch,
  TimelineNode,
  SynthesisData,
  CompleteData,
  ProgressData,
  NodeProgressData,
  SkeletonNodeData,
  NodeDetailEvent,
} from "@/types";
import { useLocale } from "@/data/landing";
import { useResearchStream } from "@/hooks/useResearchStream";
import { useConnections } from "@/hooks/useConnections";
import { useActiveNode } from "@/hooks/useActiveNode";
import { AppShell } from "./AppShell";
import { ProposalCard } from "./ProposalCard";
import { Timeline } from "./Timeline";
import { DetailPanel } from "./DetailPanel";
import { SimilarTopicCard } from "./SimilarTopicCard";
import TopBar from "./TopBar";
import ProgressBar from "./ProgressBar";
import CompletionBanner from "./CompletionBanner";
import SynthesisBanner from "./SynthesisBanner";
import SkeletonNode from "./SkeletonNode";
import EraNavigator from "./EraNavigator";

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

type SessionPhase = "loading" | "similar" | "proposal" | "research" | "error";

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

  const [similarTopic, setSimilarTopic] = useState<SimilarTopicMatch | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [scrollState, setScrollState] = useState({
    scrollTop: 0,
    scrollHeight: 1,
    viewportHeight: 1,
  });

  const [researchPhase, setResearchPhase] = useState<string>("");
  const [researchModel, setResearchModel] = useState<string>("");
  const [researchStartTime] = useState<number>(Date.now());
  const [nodeProgressMap, setNodeProgressMap] = useState<
    Map<string, NodeProgressData>
  >(new Map());

  // --- Init ---
  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

    if (sessionId === "new") {
      // New search -- POST to create session
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
          if (data.similar_topic) {
            setSimilarTopic(data.similar_topic);
            setPhase("similar");
            return;
          }

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

    // Existing session -- fetch status
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

  // --- Elapsed timer (for ProgressBar) ---
  useEffect(() => {
    if (completeData) return;
    if (phase !== "research") return;
    const timer = setInterval(
      () => setElapsed(Math.floor((Date.now() - researchStartTime) / 1000)),
      1000,
    );
    return () => clearInterval(timer);
  }, [researchStartTime, completeData, phase]);

  // --- Scroll tracking for MiniMap viewport indicator ---
  useEffect(() => {
    const onScroll = () => {
      setScrollState({
        scrollTop: window.scrollY,
        scrollHeight: document.documentElement.scrollHeight,
        viewportHeight: window.innerHeight,
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [nodes.length, selectedNodeId]);

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

  function handleViewSimilar() {
    if (!similarTopic || isNavigating) return;
    setIsNavigating(true);
    fetch("/api/research", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: similarTopic.topic, language: "auto" }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        const sid: string = data.session_id;
        setRealSessionId(sid);
        setProposal(data.proposal);
        window.history.replaceState(null, "", `/app/session/${sid}`);

        if (data.cached) {
          setActiveSession({ sessionId: sid, topic: data.proposal.topic });
          setStreamSessionId(sid);
          setPhase("research");
        } else {
          // Fallback: DB record may have been deleted
          setPhase("proposal");
        }
      })
      .catch(() => {
        setIsNavigating(false);
        setPhase("error");
        setError("Failed to load research.");
      });
  }

  function handleForceNewResearch() {
    const topic = searchParams.get("topic");
    if (!topic || isNavigating) return;
    setIsNavigating(true);
    setPhase("loading");
    fetch("/api/research", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic, language: "auto", force: true }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        const sid: string = data.session_id;
        setRealSessionId(sid);
        setProposal(data.proposal);
        window.history.replaceState(null, "", `/app/session/${sid}`);
        setIsNavigating(false);
        setPhase("proposal");
      })
      .catch(() => {
        setIsNavigating(false);
        setPhase("error");
        setError("Failed to create research.");
      });
  }

  const handleNavigateToNode = useCallback((targetId: string) => {
    setSelectedNodeId(targetId);
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>(`[data-node-id="${targetId}"]`);
      if (el) {
        const rect = el.getBoundingClientRect();
        window.scrollTo({ top: window.scrollY + rect.top - 140, behavior: "smooth" });
      }
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
      setResearchPhase(data.phase);
      if (data.model) setResearchModel(data.model);
      if (data.phase === "detail") {
        setNodes((prev) =>
          prev.map((n) =>
            n.status === "skeleton" ? { ...n, status: "loading" as const } : n,
          ),
        );
      }
    }, []),

    onNodeProgress: useCallback((data: NodeProgressData) => {
      setNodeProgressMap((prev) => {
        const next = new Map(prev);
        next.set(data.node_id, data);
        return next;
      });
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
      setNodeProgressMap((prev) => {
        const next = new Map(prev);
        next.delete(node_id);
        return next;
      });
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
  const connectionMap = useConnections(synthesisData?.connections, nodes);
  const connections = synthesisData?.connections ?? [];

  const completionTimeStr = useMemo(() => {
    if (!completeData) return "";
    const m = Math.floor(elapsed / 60);
    const s = elapsed % 60;
    return m > 0 ? `${m}:${String(s).padStart(2, "0")}` : `0:${String(s).padStart(2, "0")}`;
  }, [completeData, elapsed]);

  const nodeIds = useMemo(() => nodes.map((n) => n.id), [nodes]);
  const activeNodeId = useActiveNode(nodeIds);

  const activeNode = activeNodeId
    ? nodes.find((n) => n.id === activeNodeId)
    : null;
  const activeYear = activeNode ? activeNode.date.slice(0, 4) : null;
  const activePhase = activeNode?.phase_name ?? null;

  // --- Non-research phases: wrapped in AppShell ---
  if (phase !== "research") {
    return (
      <AppShell
        locale={locale}
        onToggleLocale={toggleLocale}
        mode="session"
        topic={proposal?.topic ?? searchParams.get("topic") ?? undefined}
        activeYear={activeYear}
        activePhase={activePhase}
        onBack={handleNewResearch}
      >
        {phase === "loading" && (
          <div className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center px-4">
            <div className="w-full max-w-xl animate-pulse rounded-2xl border border-chrono-border bg-chrono-surface/80 p-8">
              <div className="flex items-center gap-3">
                <div className="h-6 w-40 rounded bg-chrono-border" />
                <div className="flex gap-1">
                  {Array.from({ length: 4 }, (_, i) => (
                    <div key={i} className="h-2 w-2 rounded-full bg-chrono-border" />
                  ))}
                </div>
                <div className="h-4 w-24 rounded bg-chrono-border" />
              </div>
              <div className="mt-3 h-4 w-full rounded bg-chrono-border" />
              <div className="mt-1.5 h-4 w-3/4 rounded bg-chrono-border" />

              <div className="mt-6">
                <div className="h-3 w-28 rounded bg-chrono-border" />
                <div className="mt-3 space-y-2">
                  {Array.from({ length: 3 }, (_, i) => (
                    <div key={i} className="flex items-center gap-3 rounded-lg bg-chrono-bg/50 px-3 py-3">
                      <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-chrono-border" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-3.5 w-1/3 rounded bg-chrono-border" />
                        <div className="h-3 w-2/3 rounded bg-chrono-border" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-5 flex gap-2">
                <div className="h-4 w-20 rounded bg-chrono-border" />
                <div className="h-4 w-16 rounded bg-chrono-border" />
                <div className="h-4 w-16 rounded bg-chrono-border" />
              </div>

              <div className="mt-6 flex gap-3">
                <div className="h-12 flex-1 rounded-lg bg-chrono-border" />
                <div className="h-12 w-24 rounded-lg bg-chrono-border" />
              </div>
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

        {phase === "similar" && similarTopic && (
          <div className="animate-fade-in">
            <SimilarTopicCard
              originalTopic={searchParams.get("topic") ?? ""}
              similarTopic={similarTopic.topic}
              onViewExisting={handleViewSimilar}
              onNewResearch={handleForceNewResearch}
              isLoading={isNavigating}
              locale={locale}
            />
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
      </AppShell>
    );
  }

  // --- Research phase: two-column layout with TopBar + EraNavigator ---
  return (
    <div className="min-h-screen bg-chrono-bg text-chrono-text">
      <TopBar
        topic={proposal?.topic ?? ""}
        nodeCount={nodes.length}
        onBack={handleNewResearch}
        language={language}
      />

      <main className="mx-auto max-w-[1440px] px-6 pt-0 pb-16">
        {/* Era navigator — sticky under TopBar */}
        {nodes.length >= 3 && (
          <EraNavigator
            nodes={nodes}
            activeNodeId={selectedNodeId}
            hoveredId={hoveredId}
            onJumpToNode={handleNavigateToNode}
            onHoverNode={setHoveredId}
            scrollTop={scrollState.scrollTop}
            scrollHeight={scrollState.scrollHeight}
            viewportHeight={scrollState.viewportHeight}
            language={language}
          />
        )}

        <div className="flex gap-6 pt-2">
          {/* CENTER: Timeline */}
          <div className="min-w-0 flex-1">
            {!completeData && researchPhase && (
              <ProgressBar
                phase={researchPhase}
                elapsed={elapsed}
                done={nodes.filter((n) => n.status === "complete").length}
                total={nodes.length}
                model={researchModel}
                language={language}
              />
            )}
            {completeData && (
              <>
                <CompletionBanner
                  nodeCount={completeData.total_nodes}
                  timeStr={completionTimeStr}
                  language={language}
                />
                {synthesisData && (
                  <SynthesisBanner
                    synthesisData={synthesisData}
                    nodeCount={nodes.length}
                    timelineSpan={synthesisData.timeline_span}
                    language={language}
                  />
                )}
              </>
            )}

            <Timeline
              nodes={nodes}
              connections={connections}
              selectedId={selectedNodeId}
              hoveredId={hoveredId}
              onSelect={(id) =>
                setSelectedNodeId(id === selectedNodeId ? null : id)
              }
              onHover={setHoveredId}
            />

            {/* Skeleton placeholders while researching */}
            {!completeData &&
              nodes.length > 0 &&
              nodes.length <
                (proposal?.complexity?.estimated_total_nodes ?? 30) && (
                <>
                  {[0, 1, 2].map((i) => (
                    <SkeletonNode
                      key={i}
                      side={
                        (nodes.length + i) % 2 === 0 ? "right" : "left"
                      }
                    />
                  ))}
                </>
              )}
          </div>

          {/* RIGHT: DetailPanel */}
          {selectedNodeId && (
            <DetailPanel
              node={nodes.find((n) => n.id === selectedNodeId) ?? null}
              language={language}
              connectionMap={connectionMap}
              onClose={() => setSelectedNodeId(null)}
              onNavigateToNode={handleNavigateToNode}
            />
          )}
        </div>
      </main>
    </div>
  );
}
