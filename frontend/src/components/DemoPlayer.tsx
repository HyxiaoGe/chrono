"use client";

import { useReducer, useEffect } from "react";
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
  scrollY: number;
}

const TOPIC = "iPhone";
const NODE_COUNT = demoData.nodes.length;
const VISIBLE_HEIGHT = 380;

const NODE_HEIGHTS: Record<string, number> = {
  revolutionary: 120,
  high: 100,
  medium: 70,
};

function computeScrollY(activeIndex: number): number {
  let total = 0;
  for (let i = 0; i <= activeIndex; i++) {
    total += NODE_HEIGHTS[demoData.nodes[i].significance] ?? 90;
  }
  return Math.max(0, total - VISIBLE_HEIGHT + 80);
}

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
  scrollY: 0,
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
      return { ...state, phase: "skeleton", scrollY: 0 };
    case "ADD_NODE": {
      const next = state.visibleNodes + 1;
      return {
        ...state,
        visibleNodes: next,
        scrollY: computeScrollY(next - 1),
      };
    }
    case "START_DETAIL":
      return { ...state, phase: "detail" };
    case "COMPLETE_NODE": {
      const next = state.completedNodes + 1;
      return {
        ...state,
        completedNodes: next,
        scrollY: computeScrollY(next - 1),
      };
    }
    case "SHOW_SYNTHESIS": {
      const synthOffset = computeScrollY(NODE_COUNT - 1) + 120;
      return { ...state, phase: "synthesis", showSynthesis: true, scrollY: synthOffset };
    }
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

function DemoSearch({ typedChars }: { typedChars: number }) {
  const text = TOPIC.slice(0, typedChars);
  return (
    <div className="flex flex-col items-center justify-center h-[380px]">
      <div className="text-2xl font-bold text-chrono-accent mb-2">Chrono</div>
      <div className="text-chrono-tiny text-chrono-text-muted mb-6">
        Enter any topic. AI researches its timeline.
      </div>
      <div className="w-full max-w-xs">
        <div className="rounded-lg border border-chrono-border bg-chrono-bg px-4 py-2.5 flex items-center">
          <span className="text-chrono-body text-chrono-text">{text}</span>
          <span className="animate-cursor-blink text-chrono-accent ml-0.5">|</span>
        </div>
      </div>
    </div>
  );
}

function DemoProposal() {
  const { proposal } = demoData;
  return (
    <div className="flex items-center justify-center h-[380px]">
      <div className="animate-slide-up w-full max-w-sm rounded-2xl border border-chrono-border bg-chrono-surface/80 p-6 backdrop-blur-sm">
        <h3 className="text-chrono-title font-bold text-chrono-text">
          {proposal.user_facing.title}
        </h3>
        <p className="mt-2 text-chrono-caption text-chrono-text-secondary">
          {proposal.user_facing.summary}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {proposal.user_facing.thread_names.map((name) => (
            <span
              key={name}
              className="rounded-full border border-chrono-border px-2.5 py-0.5 text-chrono-tiny text-chrono-text-secondary"
            >
              {name}
            </span>
          ))}
        </div>
        <div className="mt-4 flex gap-4 text-chrono-tiny text-chrono-text-muted">
          <span>{proposal.user_facing.duration_text}</span>
          <span>{proposal.complexity.estimated_total_nodes} nodes</span>
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
          <div key={node.id} className="mb-6 flex items-start animate-fade-in">
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
    <div className="mt-8 animate-fade-in rounded-xl border border-chrono-border bg-chrono-surface p-5">
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

export function DemoPlayer() {
  const [state, dispatch] = useReducer(reducer, initialState);

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

  const isFadeout = state.phase === "fadeout";
  const showTyping = state.phase === "typing" || state.phase === "typing-out";
  const showProposal = state.phase === "proposal" || state.phase === "proposal-out";
  const showTimeline = state.visibleNodes > 0 && !showTyping && !showProposal;

  const typingOpacity = state.phase === "typing" ? 1 : 0;
  const proposalOpacity = state.phase === "proposal" ? 1 : 0;

  return (
    <div
      className="w-full max-w-2xl mx-auto rounded-2xl border border-chrono-border bg-chrono-surface/50 overflow-hidden"
      style={{ opacity: isFadeout ? 0 : 1, transition: "opacity 0.5s ease" }}
    >
      {/* Top bar */}
      <div className="h-8 flex items-center px-3 border-b border-chrono-border/50">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-chrono-border" />
          <span className="h-2.5 w-2.5 rounded-full bg-chrono-border" />
          <span className="h-2.5 w-2.5 rounded-full bg-chrono-border" />
        </div>
        <span className="mx-auto text-chrono-tiny text-chrono-text-muted">Chrono</span>
      </div>

      {/* Content area */}
      <div className="relative h-[420px] overflow-hidden">
        {/* Typing phase with fade transition */}
        {showTyping && (
          <div
            className="absolute inset-0 p-6"
            style={{ opacity: typingOpacity, transition: "opacity 0.3s ease" }}
          >
            <DemoSearch typedChars={state.typedChars} />
          </div>
        )}

        {/* Proposal phase with fade transition */}
        {showProposal && (
          <div
            className="absolute inset-0 p-6"
            style={{ opacity: proposalOpacity, transition: "opacity 0.3s ease" }}
          >
            <DemoProposal />
          </div>
        )}

        {/* Timeline + Synthesis (scrollable content) */}
        {showTimeline && (
          <div
            className="p-6"
            style={{
              transform: `translateY(-${state.scrollY}px)`,
              transition: "transform 0.6s ease-out",
            }}
          >
            <DemoTimeline
              visibleNodes={state.visibleNodes}
              completedNodes={state.completedNodes}
            />
            {state.showSynthesis && <DemoSynthesis />}
          </div>
        )}
      </div>
    </div>
  );
}
