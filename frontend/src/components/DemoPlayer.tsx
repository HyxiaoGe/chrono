"use client";

import { useReducer, useEffect, useRef } from "react";
import { demoData } from "@/data/demo";
import { TimelineNodeCard } from "./TimelineNode";
import type { TimelineNode } from "@/types";

// --- State machine ---

type DemoPhase =
  | "typing"
  | "typing-out"
  | "proposal"
  | "proposal-out"
  | "skeleton"
  | "detail"
  | "synthesis"
  | "hold"
  | "fadeout";

interface DemoState {
  phase: DemoPhase;
  typedChars: number;
  visibleNodes: number;
  completedNodes: number;
  showSynthesis: boolean;
}

interface Props {
  onInterrupt: () => void;
}

const TOPIC = "iPhone";
const NODE_COUNT = demoData.nodes.length;

type Action =
  | { type: "TICK_CHAR" }
  | { type: "TYPING_OUT" }
  | { type: "SHOW_PROPOSAL" }
  | { type: "PROPOSAL_OUT" }
  | { type: "START_SKELETON" }
  | { type: "ADD_NODE" }
  | { type: "START_DETAIL" }
  | { type: "COMPLETE_NODE" }
  | { type: "SHOW_SYNTHESIS" }
  | { type: "HOLD" }
  | { type: "FADEOUT" }
  | { type: "RESET" };

const initialState: DemoState = {
  phase: "typing",
  typedChars: 0,
  visibleNodes: 0,
  completedNodes: 0,
  showSynthesis: false,
};

function reducer(state: DemoState, action: Action): DemoState {
  switch (action.type) {
    case "TICK_CHAR":
      return { ...state, typedChars: state.typedChars + 1 };
    case "TYPING_OUT":
      return { ...state, phase: "typing-out" };
    case "SHOW_PROPOSAL":
      return { ...state, phase: "proposal" };
    case "PROPOSAL_OUT":
      return { ...state, phase: "proposal-out" };
    case "START_SKELETON":
      return { ...state, phase: "skeleton" };
    case "ADD_NODE":
      return { ...state, visibleNodes: state.visibleNodes + 1 };
    case "START_DETAIL":
      return { ...state, phase: "detail" };
    case "COMPLETE_NODE":
      return { ...state, completedNodes: state.completedNodes + 1 };
    case "SHOW_SYNTHESIS":
      return { ...state, phase: "synthesis", showSynthesis: true };
    case "HOLD":
      return { ...state, phase: "hold" };
    case "FADEOUT":
      return { ...state, phase: "fadeout" };
    case "RESET":
      return { ...initialState };
    default:
      return state;
  }
}

// --- Sub-components ---

function DemoSearch({
  typedChars,
  onInterrupt,
}: {
  typedChars: number;
  onInterrupt: () => void;
}) {
  const text = TOPIC.slice(0, typedChars);
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <h1 className="mb-2 text-chrono-hero font-bold tracking-wider text-chrono-accent">
        Chrono
      </h1>
      <p className="mb-10 text-chrono-text-muted">
        Enter any topic. AI researches its timeline.
      </p>
      <div className="flex w-full max-w-md gap-3">
        <div
          role="button"
          tabIndex={0}
          onClick={onInterrupt}
          onKeyDown={(e) => {
            if (e.key === "Enter") onInterrupt();
          }}
          className="flex-1 rounded-lg border border-chrono-border bg-chrono-surface px-4 py-3
                     text-chrono-text cursor-text flex items-center"
        >
          <span>{text}</span>
          <span className="animate-cursor-blink text-chrono-accent ml-0.5">|</span>
        </div>
        <div className="rounded-lg bg-chrono-text px-6 py-3 font-medium text-chrono-bg opacity-40">
          Research
        </div>
      </div>
    </div>
  );
}

function DemoProposal({ onInterrupt }: { onInterrupt: () => void }) {
  const { proposal } = demoData;
  const activeDots = 1;
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="animate-slide-up w-full max-w-lg rounded-2xl border border-chrono-border bg-chrono-surface/80 p-8 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <h2 className="text-chrono-title font-bold text-chrono-text">
            {proposal.user_facing.title}
          </h2>
          <div className="flex gap-1">
            {Array.from({ length: 4 }, (_, i) => (
              <div
                key={i}
                className={`h-2 w-2 rounded-full ${
                  i < activeDots ? "bg-chrono-accent" : "bg-chrono-border"
                }`}
              />
            ))}
          </div>
        </div>
        <p className="mt-2 text-chrono-body text-chrono-text-secondary">
          {proposal.user_facing.summary}
        </p>
        <div className="mt-6">
          <h3 className="text-chrono-tiny font-medium uppercase tracking-wider text-chrono-text-muted">
            Research Dimensions
          </h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {proposal.research_threads.map((thread) => (
              <span
                key={thread.name}
                className="rounded-full border border-chrono-border px-3 py-1 text-sm text-chrono-text-secondary"
                style={{ opacity: 0.4 + thread.priority * 0.12 }}
              >
                {thread.name}
              </span>
            ))}
          </div>
        </div>
        <div className="mt-6 flex gap-6 text-chrono-caption text-chrono-text-muted">
          <span>{proposal.user_facing.duration_text}</span>
          <span>{proposal.user_facing.credits_text}</span>
          <span>~{proposal.complexity.estimated_total_nodes} nodes</span>
        </div>
        <div className="mt-8 flex gap-3">
          <button
            onClick={onInterrupt}
            className="flex-1 rounded-lg bg-chrono-text py-3 font-medium text-chrono-bg
                       hover:bg-chrono-text/90 transition-colors cursor-pointer"
          >
            Start Research
          </button>
          <button
            onClick={onInterrupt}
            className="rounded-lg border border-chrono-border px-6 py-3 text-chrono-text-muted
                       hover:border-chrono-border-active hover:text-chrono-text-secondary
                       transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function DemoTimeline({
  visibleNodes,
  completedNodes,
}: {
  visibleNodes: number;
  completedNodes: number;
}) {
  const displayNodes: TimelineNode[] = demoData.nodes
    .slice(0, visibleNodes)
    .map((node, i) => {
      const isComplete = i < completedNodes;
      const detail = demoData.details[node.id];
      return {
        ...node,
        status: isComplete ? ("complete" as const) : ("skeleton" as const),
        details: isComplete ? detail : undefined,
        sources: isComplete && detail ? detail.sources : [],
      };
    });

  return (
    <div className="relative">
      <div className="absolute left-20 top-0 bottom-0 w-px bg-chrono-timeline" />
      {displayNodes.map((node) => {
        const dotSize =
          node.significance === "revolutionary"
            ? "h-4 w-4 ring-4 ring-chrono-revolutionary/20"
            : node.significance === "high"
              ? "h-3 w-3"
              : "h-2 w-2";
        const dotColor =
          node.significance === "revolutionary"
            ? "bg-chrono-revolutionary"
            : node.significance === "high"
              ? "bg-chrono-high"
              : "bg-chrono-medium";

        return (
          <div
            key={node.id}
            id={`demo-${node.id}`}
            className="mb-6 flex items-start animate-fade-in"
          >
            <div className="w-16 pt-2 text-right pr-2">
              <span className="text-chrono-tiny text-chrono-text-muted">
                {node.date.slice(0, 4)}
              </span>
            </div>
            <div className="w-8 flex justify-center pt-2">
              <span className={`rounded-full ${dotSize} ${dotColor}`} />
            </div>
            <div className="flex-1 min-w-0">
              <TimelineNodeCard
                node={node}
                isSelected={false}
                isHighlighted={false}
                connectionCount={0}
                onSelect={() => {}}
                language="en"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DemoSynthesis() {
  const { synthesis } = demoData;
  return (
    <div
      id="demo-synthesis"
      className="mt-8 animate-fade-in rounded-xl border border-chrono-border bg-chrono-surface p-5"
    >
      <h4 className="text-chrono-caption font-medium text-chrono-text-muted uppercase tracking-wider mb-3">
        Synthesis
      </h4>
      <p className="text-chrono-body text-chrono-text-secondary">{synthesis.summary}</p>
      <p className="mt-3 text-chrono-caption text-chrono-accent italic">
        {synthesis.key_insight}
      </p>
      <div className="mt-3 flex gap-4 text-chrono-tiny text-chrono-text-muted">
        <span>{synthesis.timeline_span}</span>
        <span>{synthesis.source_count} sources</span>
      </div>
    </div>
  );
}

// --- Main component ---

export function DemoPlayer({ onInterrupt }: Props) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const containerRef = useRef<HTMLDivElement>(null);

  // Timer orchestration
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    switch (state.phase) {
      case "typing":
        if (state.typedChars < TOPIC.length) {
          timer = setTimeout(() => dispatch({ type: "TICK_CHAR" }), 120);
        } else {
          timer = setTimeout(() => dispatch({ type: "TYPING_OUT" }), 600);
        }
        break;
      case "typing-out":
        timer = setTimeout(() => dispatch({ type: "SHOW_PROPOSAL" }), 350);
        break;
      case "proposal":
        timer = setTimeout(() => dispatch({ type: "PROPOSAL_OUT" }), 2500);
        break;
      case "proposal-out":
        timer = setTimeout(() => dispatch({ type: "START_SKELETON" }), 350);
        break;
      case "skeleton":
        if (state.visibleNodes < NODE_COUNT) {
          timer = setTimeout(() => dispatch({ type: "ADD_NODE" }), 300);
        } else {
          timer = setTimeout(() => dispatch({ type: "START_DETAIL" }), 500);
        }
        break;
      case "detail":
        if (state.completedNodes < NODE_COUNT) {
          timer = setTimeout(() => dispatch({ type: "COMPLETE_NODE" }), 650);
        } else {
          timer = setTimeout(() => dispatch({ type: "SHOW_SYNTHESIS" }), 500);
        }
        break;
      case "synthesis":
        timer = setTimeout(() => dispatch({ type: "HOLD" }), 2000);
        break;
      case "hold":
        timer = setTimeout(() => dispatch({ type: "FADEOUT" }), 2500);
        break;
      case "fadeout":
        timer = setTimeout(() => dispatch({ type: "RESET" }), 600);
        break;
    }

    return () => clearTimeout(timer);
  }, [state]);

  // Auto-scroll: skeleton phase
  useEffect(() => {
    if (state.phase === "skeleton" && state.visibleNodes > 0) {
      const id = `demo-${demoData.nodes[state.visibleNodes - 1].id}`;
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [state.phase, state.visibleNodes]);

  // Auto-scroll: detail phase
  useEffect(() => {
    if (state.phase === "detail" && state.completedNodes > 0) {
      const id = `demo-${demoData.nodes[state.completedNodes - 1].id}`;
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [state.phase, state.completedNodes]);

  // Auto-scroll: synthesis → top, reset → top
  useEffect(() => {
    if (state.phase === "synthesis") {
      containerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    }
    if (state.phase === "typing") {
      containerRef.current?.scrollTo({ top: 0 });
    }
  }, [state.phase]);

  const isFadeout = state.phase === "fadeout";
  const showTyping = state.phase === "typing" || state.phase === "typing-out";
  const showProposal = state.phase === "proposal" || state.phase === "proposal-out";
  const showTimeline = !showTyping && !showProposal;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-10 bg-chrono-bg overflow-y-auto"
      style={{
        opacity: isFadeout ? 0 : 1,
        transition: "opacity 0.5s ease",
        scrollbarWidth: "none",
      }}
    >
      {/* Typing phase */}
      {showTyping && (
        <div
          style={{
            opacity: state.phase === "typing" ? 1 : 0,
            transition: "opacity 0.3s ease",
          }}
        >
          <DemoSearch typedChars={state.typedChars} onInterrupt={onInterrupt} />
        </div>
      )}

      {/* Proposal phase */}
      {showProposal && (
        <div
          style={{
            opacity: state.phase === "proposal" ? 1 : 0,
            transition: "opacity 0.3s ease",
          }}
        >
          <DemoProposal onInterrupt={onInterrupt} />
        </div>
      )}

      {/* Timeline phase */}
      {showTimeline && (
        <>
          <header className="sticky top-0 z-40 flex h-12 items-center border-b border-chrono-border/50 bg-chrono-bg/80 px-6 backdrop-blur-md">
            <span className="text-chrono-caption font-semibold tracking-wider text-chrono-text-muted">
              Chrono
            </span>
            <span className="ml-4 text-chrono-caption text-chrono-text-secondary">
              iPhone
            </span>
          </header>
          <div className="mx-auto max-w-3xl px-4 py-8">
            <DemoTimeline
              visibleNodes={state.visibleNodes}
              completedNodes={state.completedNodes}
            />
            {state.showSynthesis && <DemoSynthesis />}
          </div>
        </>
      )}

      {/* Skip button (non-typing phases) */}
      {!showTyping && !isFadeout && (
        <button
          onClick={onInterrupt}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 text-chrono-tiny
                     text-chrono-text-muted hover:text-chrono-text-secondary
                     transition-colors cursor-pointer"
        >
          Skip demo
        </button>
      )}
    </div>
  );
}
