"use client";

import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type {
  CompleteData,
  ResearchProposal,
  ResearchProposalResponse,
  SimilarTopicMatch,
} from "@/types";
import { createResearch, fetchResearchStatus } from "@/api/research";
import { useLocale } from "@/data/landing";
import { useResearchStream } from "@/hooks/useResearchStream";
import { useResearchEventsReducer } from "@/hooks/useResearchEventsReducer";
import { useConnections } from "@/hooks/useConnections";
import { useActiveNode } from "@/hooks/useActiveNode";
import { createRafThrottle } from "@/utils/rafThrottle";
import { readPageScrollState } from "@/utils/scrollState";
import { getSessionConnections } from "@/utils/sessionConnections";
import { deriveSessionNodeState } from "@/utils/sessionNodeState";
import { elapsedSecondsSince, formatElapsedSeconds } from "@/utils/progressTime";
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
const NODE_ID_SEPARATOR = "\u001f";

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

function requireCreatedResearch(
  data: ResearchProposalResponse,
): asserts data is ResearchProposalResponse & {
  session_id: string;
  proposal: ResearchProposal;
} {
  if (!data.session_id || !data.proposal) {
    throw new Error("invalid_research_response");
  }
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
  const {
    nodes,
    synthesisData,
    completeData,
    researchPhase,
    researchModel,
    onProgress,
    onSkeleton,
    onNodeDetail,
    onSynthesis,
    onComplete,
  } = useResearchEventsReducer();

  const [similarTopic, setSimilarTopic] = useState<SimilarTopicMatch | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [scrollState, setScrollState] = useState({
    scrollTop: 0,
    scrollHeight: 1,
    viewportHeight: 1,
  });
  const [researchStartedAt, setResearchStartedAt] = useState(() => Date.now());
  const researchStartedAtRef = useRef(researchStartedAt);
  const [completionElapsedSeconds, setCompletionElapsedSeconds] = useState<number | null>(null);

  const updateScrollState = useCallback(() => {
    setScrollState((current) => {
      const next = readPageScrollState();
      if (
        current.scrollTop === next.scrollTop &&
        current.scrollHeight === next.scrollHeight &&
        current.viewportHeight === next.viewportHeight
      ) {
        return current;
      }
      return next;
    });
  }, []);

  const markResearchStarted = useCallback(() => {
    const startedAt = Date.now();
    researchStartedAtRef.current = startedAt;
    setResearchStartedAt(startedAt);
    setCompletionElapsedSeconds(null);
  }, []);

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

      createResearch(topic)
        .then((data) => {
          if (data.similar_topic) {
            setSimilarTopic(data.similar_topic);
            setPhase("similar");
            return;
          }

          requireCreatedResearch(data);
          const sid: string = data.session_id;
          setRealSessionId(sid);
          setProposal(data.proposal);

          // Update URL to real session ID
          window.history.replaceState(null, "", `/app/session/${sid}`);

          if (data.cached) {
            markResearchStarted();
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
    fetchResearchStatus(sessionId)
      .then((data) => {
        setProposal(data.proposal);

        if (data.status === "proposal_ready") {
          setPhase("proposal");
        } else if (data.status === "executing" || data.status === "completed") {
          markResearchStarted();
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

  // --- Scroll tracking for MiniMap viewport indicator ---
  useEffect(() => {
    const scheduleScrollStateUpdate = createRafThrottle(updateScrollState);
    updateScrollState();
    window.addEventListener("scroll", scheduleScrollStateUpdate, { passive: true });
    window.addEventListener("resize", scheduleScrollStateUpdate);
    return () => {
      scheduleScrollStateUpdate.cancel();
      window.removeEventListener("scroll", scheduleScrollStateUpdate);
      window.removeEventListener("resize", scheduleScrollStateUpdate);
    };
  }, [updateScrollState]);

  useEffect(() => {
    updateScrollState();
  }, [nodes.length, selectedNodeId, updateScrollState]);

  function handleConfirm() {
    if (!proposal || !realSessionId) return;
    markResearchStarted();
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
    createResearch(similarTopic.topic)
      .then((data) => {
        requireCreatedResearch(data);
        const sid: string = data.session_id;
        setRealSessionId(sid);
        setProposal(data.proposal);
        window.history.replaceState(null, "", `/app/session/${sid}`);

        if (data.cached) {
          markResearchStarted();
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
    createResearch(topic, { force: true })
      .then((data) => {
        requireCreatedResearch(data);
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
    });
  }, []);

  const handleSelectNode = useCallback((id: string) => {
    setSelectedNodeId((currentId) => (currentId === id ? null : id));
  }, []);

  const handleCloseDetailPanel = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  // --- SSE ---
  useResearchStream(streamSessionId, {
    onProgress,
    onSkeleton,
    onNodeDetail,
    onSynthesis,
    onComplete: useCallback((data: CompleteData) => {
      setCompletionElapsedSeconds(elapsedSecondsSince(researchStartedAtRef.current));
      onComplete(data);
      clearActiveSession();
    }, [onComplete]),

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
  const connections = getSessionConnections(synthesisData);

  const completionTimeStr = useMemo(() => {
    if (!completeData) return "";
    return formatElapsedSeconds(
      completionElapsedSeconds ?? elapsedSecondsSince(researchStartedAtRef.current),
    );
  }, [completeData, completionElapsedSeconds]);

  const nodeIdSignature = useMemo(
    () => nodes.map((node) => node.id).join(NODE_ID_SEPARATOR),
    [nodes],
  );
  const nodeIds = useMemo(
    () => (nodeIdSignature ? nodeIdSignature.split(NODE_ID_SEPARATOR) : []),
    [nodeIdSignature],
  );
  const activeNodeId = useActiveNode(nodeIds);
  const sessionNodeState = useMemo(
    () => deriveSessionNodeState(nodes, { activeNodeId, selectedNodeId }),
    [activeNodeId, nodes, selectedNodeId],
  );

  // --- Non-research phases: wrapped in AppShell ---
  if (phase !== "research") {
    return (
      <AppShell
        locale={locale}
        onToggleLocale={toggleLocale}
        mode="session"
        topic={proposal?.topic ?? searchParams.get("topic") ?? undefined}
        activeYear={sessionNodeState.activeYear}
        activePhase={sessionNodeState.activePhase}
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
      />

      <main className="mx-auto max-w-[1440px] px-6 pt-0 pb-16">
        {/* Era navigator — sticky under TopBar */}
        {nodes.length >= 3 && (
          <EraNavigator
            nodes={nodes}
            activeNodeId={selectedNodeId ?? activeNodeId}
            hoveredId={hoveredId}
            onJumpToNode={handleNavigateToNode}
            onHoverNode={setHoveredId}
            scrollTop={scrollState.scrollTop}
            scrollHeight={scrollState.scrollHeight}
            viewportHeight={scrollState.viewportHeight}
            language={language}
          />
        )}

        <div className="flex gap-6 pt-2 min-h-[calc(100vh-10rem)]">
          {/* CENTER: Timeline */}
          <div className="min-w-0 flex-1 pb-[60vh]">
            {!completeData && researchPhase && (
              <ProgressBar
                key={researchStartedAt}
                phase={researchPhase}
                startedAt={researchStartedAt}
                done={sessionNodeState.completedNodeCount}
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
              onSelect={handleSelectNode}
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
              node={sessionNodeState.selectedNode}
              language={language}
              connectionMap={connectionMap}
              onClose={handleCloseDetailPanel}
              onNavigateToNode={handleNavigateToNode}
            />
          )}
        </div>
      </main>
    </div>
  );
}
